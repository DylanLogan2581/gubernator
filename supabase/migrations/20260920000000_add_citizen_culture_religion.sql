-- Migration: add_citizen_culture_religion
-- Epic 11 (#1097): culture/religion live on citizens so they travel with the
-- citizen (settlement moves, migrations) instead of only being recorded on
-- nations. Newborns inherit from parents via the fertility phase's seeded
-- RNG; existing citizens are seeded via a world-admin-only bulk RPC.
-- ---------------------------------------------------------------------------
alter table public.citizens
add column culture_id uuid references public.cultures (id) on delete set null,
add column religion_id uuid references public.religions (id) on delete set null;

create index citizens_culture_id_idx on public.citizens (culture_id);

create index citizens_religion_id_idx on public.citizens (religion_id);

-- ---------------------------------------------------------------------------
-- §1: create_citizen_internal — add p_culture_id / p_religion_id (default
-- null). Invalid values (wrong world, deleted) degrade to null rather than
-- dropping the citizen, mirroring the nameset-id handling above.
-- ---------------------------------------------------------------------------
drop function if exists public.create_citizen_internal (
  uuid,
  uuid,
  text,
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
  text,
  uuid
);

create or replace function public.create_citizen_internal (
  p_world_id uuid,
  p_settlement_id uuid,
  p_citizen_type text,
  p_given_name text,
  p_surname text DEFAULT NULL,
  p_sex text DEFAULT NULL,
  p_user_id uuid DEFAULT NULL,
  p_born_on_turn_number integer DEFAULT NULL,
  p_parent_a_citizen_id uuid DEFAULT NULL,
  p_parent_b_citizen_id uuid DEFAULT NULL,
  p_personality_text text DEFAULT NULL,
  p_skills_text text DEFAULT NULL,
  p_profile_photo_url text DEFAULT NULL,
  p_npc_trait_1 text DEFAULT NULL,
  p_npc_trait_2 text DEFAULT NULL,
  p_npc_secret_contradiction text DEFAULT NULL,
  p_npc_goal text DEFAULT NULL,
  p_npc_flaw text DEFAULT NULL,
  p_nameset_id uuid DEFAULT NULL,
  p_culture_id uuid DEFAULT NULL,
  p_religion_id uuid DEFAULT NULL
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
  v_nameset_id uuid := p_nameset_id;
  v_culture_id uuid := p_culture_id;
  v_religion_id uuid := p_religion_id;
begin
  if p_world_id is null or p_given_name is null then
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

  if char_length(btrim(p_given_name)) = 0 then
    return;
  end if;

  if p_parent_a_citizen_id is not null
     and p_parent_b_citizen_id is not null
     and p_parent_a_citizen_id = p_parent_b_citizen_id then
    return;
  end if;

  if coalesce(current_setting('role', true), '') <> 'service_role'
     and not (
       public.is_super_admin ()
       or public.is_world_admin (p_world_id)
     ) then
    return;
  end if;

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

  if p_settlement_id is not null then
    select n.world_id into v_settlement_world_id
    from public.settlements s
    inner join public.nations n on n.id = s.nation_id
    where s.id = p_settlement_id;

    if v_settlement_world_id is null or v_settlement_world_id <> p_world_id then
      return;
    end if;
  end if;

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

  if p_user_id is not null then
    if not exists (
      select 1 from public.users u where u.id = p_user_id
    ) then
      return;
    end if;
  end if;

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

  -- Invalid namesets (wrong world, trashed, or deleted) degrade to null
  -- rather than dropping the citizen: births must never be lost to a
  -- nameset that disappeared between planning and apply.
  if v_nameset_id is not null then
    if not exists (
      select 1
      from public.namesets ns
      where ns.id = v_nameset_id
        and ns.world_id = p_world_id
        and ns.is_trashed = false
    ) then
      v_nameset_id := null;
    end if;
  end if;

  -- Same degrade-to-null handling for inherited culture/religion: a value
  -- deleted or belonging to another world must not sink the birth.
  if v_culture_id is not null then
    if not exists (
      select 1 from public.cultures c
      where c.id = v_culture_id and c.world_id = p_world_id
    ) then
      v_culture_id := null;
    end if;
  end if;

  if v_religion_id is not null then
    if not exists (
      select 1 from public.religions r
      where r.id = v_religion_id and r.world_id = p_world_id
    ) then
      v_religion_id := null;
    end if;
  end if;

  return query
  insert into public.citizens (
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    surname,
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
    npc_flaw,
    nameset_id,
    culture_id,
    religion_id
  )
  values (
    p_world_id,
    p_settlement_id,
    p_citizen_type,
    btrim(p_given_name),
    nullif(btrim(coalesce(p_surname, '')), ''),
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
    nullif(btrim(coalesce(p_npc_flaw, '')), ''),
    v_nameset_id,
    v_culture_id,
    v_religion_id
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
  text,
  uuid,
  uuid,
  uuid
)
from
  public,
  anon,
  authenticated,
  service_role;

-- ---------------------------------------------------------------------------
-- §2: internal_apply_turn_transition_citizen_partnership_patches — extract
-- cultureId/religionId from each birth payload entry and pass through.
-- ---------------------------------------------------------------------------
create or replace function public.internal_apply_turn_transition_citizen_partnership_patches (
  p_world_id uuid,
  p_transition_id uuid,
  p_payload jsonb,
  out backfill_count integer,
  out citizen_birth_count integer,
  out citizen_death_count integer,
  out partnership_change_count integer,
  out assignment_clear_count integer,
  out overshoot_stamp_count integer
) returns record language plpgsql security definer
set
  search_path = '' as $$
declare
  v_backfill jsonb;
  v_backfill_citizen_id uuid;
  v_backfill_born_on_turn_number integer;
  v_birth jsonb;
  v_birth_settlement_id uuid;
  v_birth_given_name text;
  v_birth_surname text;
  v_birth_sex text;
  v_birth_born_on_turn_number integer;
  v_birth_nameset_id uuid;
  v_birth_culture_id uuid;
  v_birth_religion_id uuid;
  v_parent_a_citizen_id uuid;
  v_parent_b_citizen_id uuid;
  v_npc_trait_1 text;
  v_npc_trait_2 text;
  v_npc_secret_contradiction text;
  v_npc_goal text;
  v_npc_flaw text;
  v_death jsonb;
  v_citizen_id uuid;
  v_citizen_type text;
  v_citizen_status text;
  v_death_cause_category public.death_cause_category;
  v_death_cause text;
  v_partnership_change jsonb;
  v_partner_a_id uuid;
  v_partner_b_id uuid;
  v_partnership_id uuid;
  v_partnership_to_status text;
  v_formed_on_turn_number integer;
  v_ended_on_turn_number integer;
  v_assignment_clear jsonb;
begin
  backfill_count           := 0;
  citizen_birth_count      := 0;
  citizen_death_count      := 0;
  partnership_change_count := 0;
  assignment_clear_count   := 0;
  overshoot_stamp_count    := 0;

  for v_backfill in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'bornOnTurnBackfill', '[]'::jsonb))
  loop
    v_backfill_citizen_id          := (v_backfill ->> 'citizenId')::uuid;
    v_backfill_born_on_turn_number := (v_backfill ->> 'bornOnTurnNumber')::integer;

    update public.citizens
    set
      born_on_turn_number = v_backfill_born_on_turn_number
    where
      id = v_backfill_citizen_id;

    backfill_count := backfill_count + 1;
  end loop;

  -- Birth payloads now carry givenName/surname. Keep name as a compatibility
  -- fallback for older focused pgTAP fixtures.
  for v_birth in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'citizenBirths', '[]'::jsonb))
  loop
    v_birth_settlement_id       := (v_birth ->> 'settlementId')::uuid;
    v_birth_given_name          := coalesce(v_birth ->> 'givenName', v_birth ->> 'name');
    v_birth_surname             := v_birth ->> 'surname';
    v_birth_sex                 := v_birth ->> 'sex';
    v_birth_born_on_turn_number := (v_birth ->> 'bornOnTurnNumber')::integer;
    v_parent_a_citizen_id       := (v_birth ->> 'parentACitizenId')::uuid;
    v_parent_b_citizen_id       := (v_birth ->> 'parentBCitizenId')::uuid;
    v_npc_trait_1               := v_birth ->> 'npcTrait1';
    v_npc_trait_2               := v_birth ->> 'npcTrait2';
    v_npc_secret_contradiction  := v_birth ->> 'npcSecretContradiction';
    v_npc_goal                  := v_birth ->> 'npcGoal';
    v_npc_flaw                  := v_birth ->> 'npcFlaw';
    v_birth_nameset_id          := (v_birth ->> 'namesetId')::uuid;
    v_birth_culture_id          := (v_birth ->> 'cultureId')::uuid;
    v_birth_religion_id         := (v_birth ->> 'religionId')::uuid;

    perform public.create_citizen_internal (
      p_world_id,
      v_birth_settlement_id,
      'npc',
      v_birth_given_name,
      v_birth_surname,
      v_birth_sex,
      null,
      v_birth_born_on_turn_number,
      v_parent_a_citizen_id,
      v_parent_b_citizen_id,
      null,
      null,
      null,
      v_npc_trait_1,
      v_npc_trait_2,
      v_npc_secret_contradiction,
      v_npc_goal,
      v_npc_flaw,
      v_birth_nameset_id,
      v_birth_culture_id,
      v_birth_religion_id
    );

    citizen_birth_count := citizen_birth_count + 1;
  end loop;

  for v_death in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'citizenDeaths', '[]'::jsonb))
  loop
    v_citizen_id           := (v_death ->> 'citizenId')::uuid;
    v_death_cause_category := (v_death ->> 'deathCauseCategory')::public.death_cause_category;
    v_death_cause          := v_death ->> 'deathCause';

    select c.citizen_type
    into v_citizen_type
    from public.citizens c
    where c.id = v_citizen_id;

    if not found then
      raise exception 'citizen % not found', v_citizen_id using errcode = 'P0001';
    end if;

    if v_citizen_type = 'player_character' then
      raise exception 'simulation engine may not kill a player character (citizen %)', v_citizen_id
        using errcode = 'P0001';
    end if;

    -- Issue #1078: a dead citizen can no longer hold a manager role. Clearing
    -- it here (rather than leaving it to be resolved out-of-band) makes the
    -- nation/settlement manager-vacant the instant the transition applies,
    -- which is what nation_readiness_eligible_voter_ids and every recipient
    -- query in this module already assume ("status = 'alive'" is checked
    -- everywhere a role is used for authority or notification fan-out — the
    -- role itself lingering past death was the actual gap, not those checks).
    update public.citizens
    set
      status               = 'dead',
      death_cause_category = v_death_cause_category,
      death_cause          = v_death_cause,
      role_type            = 'none',
      role_nation_id       = null,
      role_settlement_id   = null
    where
      id = v_citizen_id;

    citizen_death_count := citizen_death_count + 1;
  end loop;

  for v_partnership_change in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'partnershipChanges', '[]'::jsonb))
  loop
    v_partner_a_id          := (v_partnership_change ->> 'citizenAId')::uuid;
    v_partner_b_id          := (v_partnership_change ->> 'citizenBId')::uuid;
    v_partnership_to_status := v_partnership_change ->> 'toStatus';
    v_formed_on_turn_number := (v_partnership_change ->> 'formedOnTurnNumber')::integer;
    v_ended_on_turn_number  := (v_partnership_change ->> 'endedOnTurnNumber')::integer;

    if v_partnership_to_status = 'active' then
      select c.status into v_citizen_status
      from public.citizens c
      where c.id = v_partner_a_id;

      if not found then
        raise exception 'citizen % not found', v_partner_a_id using errcode = 'P0001';
      end if;

      if v_citizen_status = 'dead' then
        raise exception 'simulation engine may not form a partnership with a dead citizen (citizen %)', v_partner_a_id
          using errcode = 'P0001';
      end if;

      select c.status into v_citizen_status
      from public.citizens c
      where c.id = v_partner_b_id;

      if not found then
        raise exception 'citizen % not found', v_partner_b_id using errcode = 'P0001';
      end if;

      if v_citizen_status = 'dead' then
        raise exception 'simulation engine may not form a partnership with a dead citizen (citizen %)', v_partner_b_id
          using errcode = 'P0001';
      end if;

      insert into public.partnerships (
        citizen_a_id,
        citizen_b_id,
        status,
        formed_on_turn_number
      )
      values (
        v_partner_a_id,
        v_partner_b_id,
        'active',
        v_formed_on_turn_number
      );
    else
      select p.id
      into v_partnership_id
      from public.partnerships p
      where (
        (p.citizen_a_id = v_partner_a_id and p.citizen_b_id = v_partner_b_id)
        or (p.citizen_a_id = v_partner_b_id and p.citizen_b_id = v_partner_a_id)
      )
      and p.status = 'active';

      if not found then
        raise exception 'active partnership between % and % not found', v_partner_a_id, v_partner_b_id
          using errcode = 'P0001';
      end if;

      update public.partnerships
      set
        status               = v_partnership_to_status,
        ended_on_turn_number = v_ended_on_turn_number
      where
        id = v_partnership_id;
    end if;

    partnership_change_count := partnership_change_count + 1;
  end loop;

  for v_assignment_clear in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'assignmentClears', '[]'::jsonb))
  loop
    v_citizen_id := (v_assignment_clear ->> 'citizenId')::uuid;

    delete from public.citizen_assignments
    where citizen_id = v_citizen_id;

    assignment_clear_count := assignment_clear_count + 1;
  end loop;

  update public.turn_log_entries
  set
    turn_transition_id = p_transition_id
  where
    world_id = p_world_id
    and log_category = 'manual_deconstruct_overshoot'
    and turn_transition_id is null;

  get diagnostics overshoot_stamp_count = row_count;
end;
$$;

revoke all on function public.internal_apply_turn_transition_citizen_partnership_patches (uuid, uuid, jsonb)
from
  public,
  anon,
  authenticated;

-- ---------------------------------------------------------------------------
-- §3: bulk_set_citizen_culture_religion — world-admin-only seeding tool for
-- existing citizens. Null leaves that field untouched (unlike
-- set_citizen_culture_religion below, which always clears on null since it
-- edits one citizen's fields directly).
-- ---------------------------------------------------------------------------
create or replace function public.bulk_set_citizen_culture_religion (
  p_settlement_id uuid,
  p_culture_id uuid,
  p_religion_id uuid
) returns setof public.citizens language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
begin
  select n.world_id into v_world_id
  from public.settlements s
  inner join public.nations n on n.id = s.nation_id
  where s.id = p_settlement_id;

  if v_world_id is null then
    raise exception 'Settlement not found.' using errcode = 'P0002';
  end if;

  if not (
    public.is_world_admin (v_world_id)
    or public.is_super_admin ()
  ) then
    raise exception 'You do not have permission to manage citizens in this settlement.'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  if p_culture_id is not null and not exists (
    select 1 from public.cultures where id = p_culture_id and world_id = v_world_id
  ) then
    raise exception 'Culture does not belong to this settlement''s world.'
      using errcode = 'P0001';
  end if;

  if p_religion_id is not null and not exists (
    select 1 from public.religions where id = p_religion_id and world_id = v_world_id
  ) then
    raise exception 'Religion does not belong to this settlement''s world.'
      using errcode = 'P0001';
  end if;

  return query
  update public.citizens
  set
    culture_id = coalesce(p_culture_id, culture_id),
    religion_id = coalesce(p_religion_id, religion_id)
  where
    settlement_id = p_settlement_id
    and status = 'alive'
  returning *;
end;
$$;

revoke all on function public.bulk_set_citizen_culture_religion (uuid, uuid, uuid)
from
  public;

grant
execute on function public.bulk_set_citizen_culture_religion (uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- §4: set_citizen_culture_religion — single-citizen admin edit. Unlike the
-- bulk RPC above, null clears the field (standard single-field-edit
-- semantics, matching set_nation_culture_religion).
-- ---------------------------------------------------------------------------
create or replace function public.set_citizen_culture_religion (
  p_citizen_id uuid,
  p_culture_id uuid,
  p_religion_id uuid
) returns setof public.citizens language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
begin
  select world_id into v_world_id from public.citizens where id = p_citizen_id;

  if v_world_id is null then
    return;
  end if;

  if not (
    public.is_world_admin (v_world_id)
    or public.is_super_admin ()
  ) then
    raise exception 'You do not have permission to manage this citizen.'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  if p_culture_id is not null and not exists (
    select 1 from public.cultures where id = p_culture_id and world_id = v_world_id
  ) then
    raise exception 'Culture does not belong to this citizen''s world.'
      using errcode = 'P0001';
  end if;

  if p_religion_id is not null and not exists (
    select 1 from public.religions where id = p_religion_id and world_id = v_world_id
  ) then
    raise exception 'Religion does not belong to this citizen''s world.'
      using errcode = 'P0001';
  end if;

  return query
  update public.citizens
  set
    culture_id = p_culture_id,
    religion_id = p_religion_id
  where
    id = p_citizen_id
  returning *;
end;
$$;

revoke all on function public.set_citizen_culture_religion (uuid, uuid, uuid)
from
  public;

grant
execute on function public.set_citizen_culture_religion (uuid, uuid, uuid) to authenticated;
