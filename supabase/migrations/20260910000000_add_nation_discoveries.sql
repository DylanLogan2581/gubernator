-- Migration: add_nation_discoveries
-- #1085: pairwise nation discovery. Two nations "have met" once an admin
-- records a nation_discoveries row for their canonical (unordered) pair.
-- This migration only introduces the data + admin controls; visibility
-- ENFORCEMENT (filtering nation lists, trade, diplomacy by met state,
-- removing nations.is_hidden) is a separate follow-up issue.
-- ---------------------------------------------------------------------------
-- nation_discoveries
-- ---------------------------------------------------------------------------
-- nation_a_id / nation_b_id store the pair in canonical order (a < b) so a
-- pair has exactly one row regardless of which nation is "first" in the UI.
create table public.nation_discoveries (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  nation_a_id uuid not null references public.nations (id) on delete cascade,
  nation_b_id uuid not null references public.nations (id) on delete cascade,
  met_at_turn_number integer not null,
  created_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint nation_discoveries_canonical_pair_check check (nation_a_id < nation_b_id),
  constraint nation_discoveries_met_at_turn_number_check check (met_at_turn_number >= 0),
  constraint nation_discoveries_unique_pair unique (nation_a_id, nation_b_id)
);

create index nation_discoveries_world_id_idx on public.nation_discoveries (world_id);

create index nation_discoveries_nation_a_id_idx on public.nation_discoveries (nation_a_id);

create index nation_discoveries_nation_b_id_idx on public.nation_discoveries (nation_b_id);

alter table public.nation_discoveries enable row level security;

-- ---------------------------------------------------------------------------
-- current_user_has_player_character_in_nation: TRUE when the current user
-- controls at least one living player_character whose settlement belongs to
-- the given nation. Mirrors the shape of
-- current_user_player_character_ids(p_world_id) (20260522000001) but scoped
-- to a nation instead of a whole world, for the nation_discoveries member
-- read policy below.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_has_player_character_in_nation (p_nation_id uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select exists (
    select 1
    from public.citizens c
    join public.settlements s on s.id = c.settlement_id
    where s.nation_id = p_nation_id
      and c.user_id = auth.uid()
      and c.citizen_type = 'player_character'
      and c.status = 'alive'
  )
$$;

-- ---------------------------------------------------------------------------
-- RLS: world admins/super admins see every pair for their world; members see
-- pairs involving a nation where they hold a player character.
-- ---------------------------------------------------------------------------
create policy "nation_discoveries_select_admin" on public.nation_discoveries for
select
  to authenticated using (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

create policy "nation_discoveries_select_member" on public.nation_discoveries for
select
  to authenticated using (
    public.current_user_has_player_character_in_nation (nation_a_id)
    or public.current_user_has_player_character_in_nation (nation_b_id)
  );

grant
select
  on public.nation_discoveries to authenticated;

-- ---------------------------------------------------------------------------
-- nations_have_met: TRUE when the two nations are the same nation, or a
-- nation_discoveries row exists for their canonical pair.
-- ---------------------------------------------------------------------------
create or replace function public.nations_have_met (a uuid, b uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select
    a = b
    or exists (
      select 1
      from public.nation_discoveries
      where nation_a_id = least(a, b)
        and nation_b_id = greatest(a, b)
    )
$$;

revoke all on function public.nations_have_met (uuid, uuid)
from
  public;

grant
execute on function public.nations_have_met (uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- set_nations_met / set_nations_unmet: world admin/super admin only. Records
-- or removes the canonical-pair discovery row. Unmeeting is an admin
-- correction tool; it intentionally does not cascade-delete relationships or
-- trade (a separate enforcement issue handles blocking interactions between
-- unmet nations).
-- ---------------------------------------------------------------------------
create or replace function public.set_nations_met (p_a uuid, p_b uuid) returns public.nation_discoveries language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_other_world_id uuid;
  v_turn_number integer;
  v_row public.nation_discoveries%rowtype;
begin
  if p_a is null or p_b is null then
    raise exception 'both nations are required'
      using errcode = '22023';
  end if;

  if p_a = p_b then
    raise exception 'a nation cannot be marked as having met itself'
      using errcode = '22023';
  end if;

  select world_id into v_world_id from public.nations where id = p_a;
  select world_id into v_other_world_id from public.nations where id = p_b;

  if v_world_id is null or v_other_world_id is null then
    raise exception 'nation not found'
      using errcode = 'P0002';
  end if;

  if v_world_id <> v_other_world_id then
    raise exception 'both nations must belong to the same world'
      using errcode = '22023';
  end if;

  if not (
    public.is_world_admin (v_world_id)
    or public.is_super_admin ()
  ) then
    raise exception 'You do not have permission to manage nation discovery for this world.'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  select current_turn_number into v_turn_number
  from public.worlds
  where id = v_world_id;

  insert into public.nation_discoveries (
    world_id,
    nation_a_id,
    nation_b_id,
    met_at_turn_number,
    created_by_user_id
  )
  values (
    v_world_id,
    least(p_a, p_b),
    greatest(p_a, p_b),
    v_turn_number,
    auth.uid ()
  )
  on conflict (nation_a_id, nation_b_id) do update
  set met_at_turn_number = excluded.met_at_turn_number,
    created_by_user_id = excluded.created_by_user_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.set_nations_met (uuid, uuid)
from
  public;

grant
execute on function public.set_nations_met (uuid, uuid) to authenticated;

create or replace function public.set_nations_unmet (p_a uuid, p_b uuid) returns void language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_other_world_id uuid;
begin
  if p_a is null or p_b is null then
    raise exception 'both nations are required'
      using errcode = '22023';
  end if;

  if p_a = p_b then
    raise exception 'a nation cannot be unmet from itself'
      using errcode = '22023';
  end if;

  select world_id into v_world_id from public.nations where id = p_a;
  select world_id into v_other_world_id from public.nations where id = p_b;

  if v_world_id is null or v_other_world_id is null then
    raise exception 'nation not found'
      using errcode = 'P0002';
  end if;

  if v_world_id <> v_other_world_id then
    raise exception 'both nations must belong to the same world'
      using errcode = '22023';
  end if;

  if not (
    public.is_world_admin (v_world_id)
    or public.is_super_admin ()
  ) then
    raise exception 'You do not have permission to manage nation discovery for this world.'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  delete from public.nation_discoveries
  where nation_a_id = least(p_a, p_b)
    and nation_b_id = greatest(p_a, p_b);
end;
$$;

revoke all on function public.set_nations_unmet (uuid, uuid)
from
  public;

grant
execute on function public.set_nations_unmet (uuid, uuid) to authenticated;
