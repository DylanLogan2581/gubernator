-- Migration: add_citizen_creation_mutations
-- Introduces the SECURITY DEFINER RPCs that govern citizen creation. Citizens
-- can already be inserted directly through the citizens table for admins, but
-- the creation paths in this migration also enforce two cross-cutting
-- invariants that direct inserts cannot: (1) the world's incest-prevention
-- depth is honored when both parents are supplied, and (2) player characters
-- are linked to a user at insert time without violating the column-level
-- grants that forbid direct user_id writes.
--
-- Authorization summary:
--   • Super admin and World Admin of the target world may use both mutations.
--   • Nation / Settlement Manager roles do NOT extend to citizen creation.
--   • Both mutations are no-ops against archived worlds.
--
-- ---------------------------------------------------------------------------
-- citizens_have_close_kinship: returns true when the two citizens share a
-- common ancestor within p_depth generations (inclusive). Depth 0 disables
-- the check; depth 1 catches siblings; depth 2 catches first cousins; and so
-- on. Each citizen counts as their own gen-0 ancestor, so the function also
-- correctly rejects pairings where one citizen is an ancestor of the other
-- within the depth window.
-- ---------------------------------------------------------------------------
create or replace function public.citizens_have_close_kinship (
  p_citizen_a_id uuid,
  p_citizen_b_id uuid,
  p_depth integer
) returns boolean language sql stable security definer
set
  search_path = '' as $$
  with recursive ancestors as (
    -- Non-recursive seed: each input citizen is their own gen-0 ancestor.
    -- Multiple branches would be ambiguous, so VALUES gives one set with up
    -- to two rows.
    select seed.side, seed.side as ancestor_id, 0 as gen
    from (
      values (p_citizen_a_id), (p_citizen_b_id)
    ) as seed (side)
    where seed.side is not null
    union all
    -- Recursive step: walk one generation up through either parent. The
    -- LATERAL subquery flattens the two parent columns into rows so the
    -- recursive part stays a single SELECT, satisfying Postgres' rule that
    -- a recursive CTE has exactly one non-recursive and one recursive term.
    select a.side, p.parent_id, a.gen + 1
    from ancestors a
    inner join public.citizens c on c.id = a.ancestor_id
    cross join lateral (
      values (c.parent_a_citizen_id), (c.parent_b_citizen_id)
    ) as p (parent_id)
    where p.parent_id is not null
      and a.gen < coalesce(p_depth, 0)
  )
  select coalesce(p_depth, 0) > 0
    and p_citizen_a_id is not null
    and p_citizen_b_id is not null
    and exists (
      select 1
      from ancestors aa
      inner join ancestors bb on aa.ancestor_id = bb.ancestor_id
      where aa.side = p_citizen_a_id
        and bb.side = p_citizen_b_id
    );
$$;

revoke all on function public.citizens_have_close_kinship (uuid, uuid, integer)
from
  public;

grant
execute on function public.citizens_have_close_kinship (uuid, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- create_citizen_internal: shared private workhorse. Performs the admin and
-- archived-world checks, validates that supplied parents belong to the same
-- world, runs the kinship check when both parents are supplied, and inserts
-- the citizen row. Returns the inserted row so each public entrypoint can
-- forward it to the caller. Defined as SECURITY DEFINER so the row's
-- citizen_type and user_id columns can be set in a single statement even
-- though column-level grants forbid direct user_id writes from the table API.
-- ---------------------------------------------------------------------------
create or replace function public.create_citizen_internal (
  p_world_id uuid,
  p_settlement_id uuid,
  p_citizen_type text,
  p_name text,
  p_sex text,
  p_user_id uuid,
  p_born_on_turn_number integer,
  p_parent_a_citizen_id uuid,
  p_parent_b_citizen_id uuid,
  p_personality_text text,
  p_skills_text text,
  p_profile_photo_url text,
  p_npc_trait_1 text,
  p_npc_trait_2 text,
  p_npc_secret_contradiction text,
  p_npc_goal text,
  p_npc_flaw text
) returns setof public.citizens language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_status text;
  v_world_archived_at timestamptz;
  v_world_incest_depth integer;
  v_parent_a_world_id uuid;
  v_parent_b_world_id uuid;
  v_settlement_world_id uuid;
begin
  if p_world_id is null or p_name is null then
    return;
  end if;

  if p_citizen_type not in ('npc', 'player_character') then
    return;
  end if;

  if p_citizen_type = 'player_character' and p_user_id is null then
    return;
  end if;

  if p_citizen_type = 'npc' and p_user_id is not null then
    return;
  end if;

  if char_length(btrim(p_name)) = 0 then
    return;
  end if;

  if p_parent_a_citizen_id is not null
     and p_parent_b_citizen_id is not null
     and p_parent_a_citizen_id = p_parent_b_citizen_id then
    return;
  end if;

  -- Admin check.
  if not (
    public.is_super_admin ()
    or public.is_world_admin (p_world_id)
  ) then
    return;
  end if;

  -- Archived-world guard.
  select w.status, w.archived_at, w.incest_prevention_depth
  into v_world_status, v_world_archived_at, v_world_incest_depth
  from public.worlds w
  where w.id = p_world_id;

  if v_world_status is null then
    return;
  end if;

  if v_world_status = 'archived' or v_world_archived_at is not null then
    return;
  end if;

  -- Settlement-world guard. settlements reach world_id through nations, so the
  -- check joins to nations rather than reading the column off settlements
  -- directly.
  if p_settlement_id is not null then
    select n.world_id into v_settlement_world_id
    from public.settlements s
    inner join public.nations n on n.id = s.nation_id
    where s.id = p_settlement_id;

    if v_settlement_world_id is null or v_settlement_world_id <> p_world_id then
      return;
    end if;
  end if;

  -- Parents must belong to the same world as the new citizen.
  if p_parent_a_citizen_id is not null then
    select c.world_id into v_parent_a_world_id
    from public.citizens c
    where c.id = p_parent_a_citizen_id;

    if v_parent_a_world_id is null or v_parent_a_world_id <> p_world_id then
      return;
    end if;
  end if;

  if p_parent_b_citizen_id is not null then
    select c.world_id into v_parent_b_world_id
    from public.citizens c
    where c.id = p_parent_b_citizen_id;

    if v_parent_b_world_id is null or v_parent_b_world_id <> p_world_id then
      return;
    end if;
  end if;

  -- Existing user guard when linking a player character.
  if p_user_id is not null then
    if not exists (
      select 1 from public.users u where u.id = p_user_id
    ) then
      return;
    end if;
  end if;

  -- Incest-prevention check.
  if p_parent_a_citizen_id is not null
     and p_parent_b_citizen_id is not null
     and coalesce(v_world_incest_depth, 0) > 0 then
    if public.citizens_have_close_kinship (
      p_parent_a_citizen_id,
      p_parent_b_citizen_id,
      v_world_incest_depth
    ) then
      return;
    end if;
  end if;

  return query
  insert into public.citizens (
    world_id,
    settlement_id,
    citizen_type,
    name,
    sex,
    status,
    born_on_turn_number,
    parent_a_citizen_id,
    parent_b_citizen_id,
    user_id,
    profile_photo_url,
    personality_text,
    skills_text,
    npc_trait_1,
    npc_trait_2,
    npc_secret_contradiction,
    npc_goal,
    npc_flaw
  )
  values (
    p_world_id,
    p_settlement_id,
    p_citizen_type,
    btrim(p_name),
    nullif(btrim(coalesce(p_sex, '')), ''),
    'alive',
    p_born_on_turn_number,
    p_parent_a_citizen_id,
    p_parent_b_citizen_id,
    p_user_id,
    nullif(btrim(coalesce(p_profile_photo_url, '')), ''),
    nullif(btrim(coalesce(p_personality_text, '')), ''),
    nullif(btrim(coalesce(p_skills_text, '')), ''),
    nullif(btrim(coalesce(p_npc_trait_1, '')), ''),
    nullif(btrim(coalesce(p_npc_trait_2, '')), ''),
    nullif(btrim(coalesce(p_npc_secret_contradiction, '')), ''),
    nullif(btrim(coalesce(p_npc_goal, '')), ''),
    nullif(btrim(coalesce(p_npc_flaw, '')), '')
  )
  returning *;
end;
$$;

revoke all on function public.create_citizen_internal (
  uuid,
  uuid,
  text,
  text,
  text,
  uuid,
  integer,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
from
  public;

-- create_citizen_internal is private. The public entrypoints below wrap it.
-- ---------------------------------------------------------------------------
-- create_npc: admin-only. Inserts an NPC row with optional flavor fields.
-- ---------------------------------------------------------------------------
create or replace function public.create_npc (
  p_world_id uuid,
  p_settlement_id uuid,
  p_name text,
  p_sex text,
  p_born_on_turn_number integer,
  p_parent_a_citizen_id uuid,
  p_parent_b_citizen_id uuid,
  p_personality_text text,
  p_skills_text text,
  p_profile_photo_url text,
  p_npc_trait_1 text,
  p_npc_trait_2 text,
  p_npc_secret_contradiction text,
  p_npc_goal text,
  p_npc_flaw text
) returns setof public.citizens language sql security definer
set
  search_path = '' as $$
  select *
  from public.create_citizen_internal (
    p_world_id,
    p_settlement_id,
    'npc',
    p_name,
    p_sex,
    null,
    p_born_on_turn_number,
    p_parent_a_citizen_id,
    p_parent_b_citizen_id,
    p_personality_text,
    p_skills_text,
    p_profile_photo_url,
    p_npc_trait_1,
    p_npc_trait_2,
    p_npc_secret_contradiction,
    p_npc_goal,
    p_npc_flaw
  );
$$;

revoke all on function public.create_npc (
  uuid,
  uuid,
  text,
  text,
  integer,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
)
from
  public;

grant
execute on function public.create_npc (
  uuid,
  uuid,
  text,
  text,
  integer,
  uuid,
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text
) to authenticated;

-- ---------------------------------------------------------------------------
-- create_player_character: admin-only. Inserts a citizen with
-- citizen_type='player_character' and the supplied user_id in a single
-- statement. NPC flavor fields are not accepted here because they only apply
-- to NPCs.
-- ---------------------------------------------------------------------------
create or replace function public.create_player_character (
  p_world_id uuid,
  p_settlement_id uuid,
  p_user_id uuid,
  p_name text,
  p_sex text,
  p_born_on_turn_number integer,
  p_parent_a_citizen_id uuid,
  p_parent_b_citizen_id uuid,
  p_personality_text text,
  p_skills_text text,
  p_profile_photo_url text
) returns setof public.citizens language sql security definer
set
  search_path = '' as $$
  select *
  from public.create_citizen_internal (
    p_world_id,
    p_settlement_id,
    'player_character',
    p_name,
    p_sex,
    p_user_id,
    p_born_on_turn_number,
    p_parent_a_citizen_id,
    p_parent_b_citizen_id,
    p_personality_text,
    p_skills_text,
    p_profile_photo_url,
    null,
    null,
    null,
    null,
    null
  );
$$;

revoke all on function public.create_player_character (
  uuid,
  uuid,
  uuid,
  text,
  text,
  integer,
  uuid,
  uuid,
  text,
  text,
  text
)
from
  public;

grant
execute on function public.create_player_character (
  uuid,
  uuid,
  uuid,
  text,
  text,
  integer,
  uuid,
  uuid,
  text,
  text,
  text
) to authenticated;
