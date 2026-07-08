-- Migration: add_armies
-- Epic 13 (#1108): armies and free-form organization tree schema. A nation's
-- army is a named container stationed at a settlement; within it, the player
-- can nest arbitrarily-named groups (divisions, regiments, ...) up to 5
-- levels deep, and place units (of a public.unit_types configuration, added
-- in 20260928000000) directly under the army or under any group. Tree
-- mutation is exposed only through the RPCs below (cycle/depth validation
-- can't be expressed declaratively); reads are plain RLS.
--
-- RLS visibility note: Epic 11's discovery-visibility helper
-- (nation_visible_to_current_user, 20260522000001) already exists for
-- *nations*, but issue #1086 (a per-nation-pair "met" gate feeding it) has
-- not landed yet, so it is not yet meaningfully restrictive here. SELECT
-- below therefore uses the plain world-access helper
-- (current_user_has_world_access) matching nation_offices. Swap to
-- nation-visibility scoping once #1086 lands.
--
-- Soldier tracking (recruit/deploy into a unit) is a separate future issue;
-- until it lands, army_units can never hold soldiers, so the "unit must be
-- empty of soldiers" deletion guard from the issue is a structural no-op
-- here (see delete_army_unit). Revisit once recruitment adds a soldier
-- count to army_units.
-- ---------------------------------------------------------------------------
-- 0. settlements(id, nation_id) unique -- required as the target of the
-- composite FK below, which declaratively enforces that an army's stationed
-- settlement belongs to the army's nation.
-- ---------------------------------------------------------------------------
alter table public.settlements
add constraint settlements_id_nation_id_unique unique (id, nation_id);

-- ---------------------------------------------------------------------------
-- 1. armies
-- ---------------------------------------------------------------------------
create table public.armies (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  nation_id uuid not null references public.nations (id) on delete cascade,
  name text not null,
  funding_source text not null check (funding_source in ('nation', 'host_settlement')),
  stationed_settlement_id uuid not null,
  created_turn_number integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint armies_name_length_check check (char_length(btrim(name)) >= 1),
  constraint armies_name_max_length_check check (char_length(name) <= 64),
  constraint armies_created_turn_number_check check (created_turn_number >= 0),
  -- Both FKs below target nations(id, world_id) / settlements(id, nation_id),
  -- which together force armies.world_id, armies.nation_id and the
  -- stationed settlement's nation to all agree.
  constraint armies_nation_world_fkey foreign key (nation_id, world_id) references public.nations (id, world_id),
  constraint armies_stationed_settlement_nation_fkey foreign key (stationed_settlement_id, nation_id) references public.settlements (id, nation_id)
);

create index armies_world_id_idx on public.armies (world_id);

create index armies_nation_id_idx on public.armies (nation_id);

create index armies_stationed_settlement_id_idx on public.armies (stationed_settlement_id);

create trigger armies_set_updated_at before
update on public.armies for each row
execute function public.set_updated_at ();

alter table public.armies enable row level security;

create policy "armies_select_world_access" on public.armies for
select
  to authenticated using (public.current_user_has_world_access (world_id));

grant
select
  on public.armies to authenticated;

-- ---------------------------------------------------------------------------
-- 2. army_groups -- self-referencing tree, depth capped at 5 (validated in
-- the move/create RPCs below by walking parents).
-- ---------------------------------------------------------------------------
create table public.army_groups (
  id uuid primary key default gen_random_uuid(),
  army_id uuid not null references public.armies (id) on delete cascade,
  parent_group_id uuid,
  name text not null,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint army_groups_name_length_check check (char_length(btrim(name)) >= 1),
  constraint army_groups_name_max_length_check check (char_length(name) <= 64),
  constraint army_groups_not_self_parent_check check (parent_group_id is distinct from id),
  -- Composite unique target for the self-FK below, and for army_units.group_id
  -- further down -- both force the referenced group to belong to the same army.
  constraint army_groups_id_army_id_unique unique (id, army_id),
  constraint army_groups_parent_army_fkey foreign key (parent_group_id, army_id) references public.army_groups (id, army_id)
);

create index army_groups_army_id_idx on public.army_groups (army_id);

create index army_groups_parent_group_id_idx on public.army_groups (parent_group_id);

create trigger army_groups_set_updated_at before
update on public.army_groups for each row
execute function public.set_updated_at ();

alter table public.army_groups enable row level security;

create policy "army_groups_select_world_access" on public.army_groups for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.armies a
      where
        a.id = army_groups.army_id
        and public.current_user_has_world_access (a.world_id)
    )
  );

grant
select
  on public.army_groups to authenticated;

-- ---------------------------------------------------------------------------
-- 3. army_units -- leaves of the tree; group_id null means "directly under
-- the army root".
-- ---------------------------------------------------------------------------
create table public.army_units (
  id uuid primary key default gen_random_uuid(),
  army_id uuid not null references public.armies (id) on delete cascade,
  group_id uuid,
  unit_type_id uuid not null references public.unit_types (id) on delete restrict,
  name text not null,
  sort_order integer not null default 0,
  created_turn_number integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint army_units_name_length_check check (char_length(btrim(name)) >= 1),
  constraint army_units_name_max_length_check check (char_length(name) <= 64),
  constraint army_units_created_turn_number_check check (created_turn_number >= 0),
  -- Forces the unit's group (when set) to belong to the same army.
  constraint army_units_group_army_fkey foreign key (group_id, army_id) references public.army_groups (id, army_id)
);

create index army_units_army_id_idx on public.army_units (army_id);

create index army_units_group_id_idx on public.army_units (group_id);

create index army_units_unit_type_id_idx on public.army_units (unit_type_id);

create trigger army_units_set_updated_at before
update on public.army_units for each row
execute function public.set_updated_at ();

alter table public.army_units enable row level security;

create policy "army_units_select_world_access" on public.army_units for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.armies a
      where
        a.id = army_units.army_id
        and public.current_user_has_world_access (a.world_id)
    )
  );

grant
select
  on public.army_units to authenticated;

-- ---------------------------------------------------------------------------
-- 4. army_group_depth(p_group_id) -- helper: 1-based depth of an *existing*
-- group (root-level group = depth 1). Used by the create/move RPCs below.
-- ---------------------------------------------------------------------------
create or replace function public.army_group_depth (p_group_id uuid) returns integer language sql stable security definer
set
  search_path = '' as $$
  with recursive chain as (
    select id, parent_group_id, 1 as depth
    from public.army_groups
    where id = p_group_id
    union all
    select g.id, g.parent_group_id, chain.depth + 1
    from public.army_groups g
    inner join chain on g.id = chain.parent_group_id
  )
  select max(depth) from chain
$$;

revoke all on function public.army_group_depth (uuid)
from
  public;

-- ---------------------------------------------------------------------------
-- 5. army_group_subtree_height(p_group_id) -- helper: max relative depth of
-- p_group_id's own subtree (itself = 0, a direct child = 1, ...). Used by
-- move_army_group to make sure relocating a group with descendants doesn't
-- push any descendant past the depth cap.
-- ---------------------------------------------------------------------------
create or replace function public.army_group_subtree_height (p_group_id uuid) returns integer language sql stable security definer
set
  search_path = '' as $$
  with recursive chain as (
    select id, 0 as relative_depth
    from public.army_groups
    where id = p_group_id
    union all
    select g.id, chain.relative_depth + 1
    from public.army_groups g
    inner join chain on g.parent_group_id = chain.id
  )
  select max(relative_depth) from chain
$$;

revoke all on function public.army_group_subtree_height (uuid)
from
  public;

-- ---------------------------------------------------------------------------
-- 6. create_army
-- ---------------------------------------------------------------------------
create or replace function public.create_army (
  p_nation_id uuid,
  p_name text,
  p_funding_source text,
  p_stationed_settlement_id uuid
) returns public.armies language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_world_status text;
  v_turn_number integer;
  v_row public.armies%rowtype;
begin
  if p_nation_id is null or p_name is null or p_funding_source is null or p_stationed_settlement_id is null then
    raise exception 'nation, name, funding source, and stationed settlement are required'
      using errcode = '22023';
  end if;

  select n.world_id, w.status, w.current_turn_number
  into v_world_id, v_world_status, v_turn_number
  from public.nations n
  inner join public.worlds w on w.id = n.world_id
  where n.id = p_nation_id;

  if v_world_id is null then
    raise exception 'nation not found'
      using errcode = 'P0002';
  end if;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if not public.current_user_manages_nation (p_nation_id) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.settlements s
    where s.id = p_stationed_settlement_id and s.nation_id = p_nation_id
  ) then
    raise exception 'stationed settlement must belong to the nation'
      using errcode = '22023', hint = 'settlement_not_in_nation';
  end if;

  insert into public.armies (
    world_id, nation_id, name, funding_source, stationed_settlement_id, created_turn_number
  )
  values (
    v_world_id, p_nation_id, p_name, p_funding_source, p_stationed_settlement_id, v_turn_number
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_army (uuid, text, text, uuid)
from
  public;

grant
execute on function public.create_army (uuid, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. rename_army
-- ---------------------------------------------------------------------------
create or replace function public.rename_army (p_army_id uuid, p_name text) returns public.armies language plpgsql security definer
set
  search_path = '' as $$
declare
  v_nation_id uuid;
  v_world_status text;
  v_row public.armies%rowtype;
begin
  if p_army_id is null or p_name is null then
    raise exception 'army and name are required'
      using errcode = '22023';
  end if;

  select a.nation_id, w.status into v_nation_id, v_world_status
  from public.armies a
  inner join public.worlds w on w.id = a.world_id
  where a.id = p_army_id
  for update of a;

  if v_nation_id is null then
    raise exception 'army not found'
      using errcode = 'P0002';
  end if;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if not public.current_user_manages_nation (v_nation_id) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  update public.armies
  set name = p_name
  where id = p_army_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.rename_army (uuid, text)
from
  public;

grant
execute on function public.rename_army (uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. delete_army -- only when the army's tree holds no groups and no units.
-- ---------------------------------------------------------------------------
create or replace function public.delete_army (p_army_id uuid) returns void language plpgsql security definer
set
  search_path = '' as $$
declare
  v_nation_id uuid;
  v_world_status text;
begin
  if p_army_id is null then
    raise exception 'p_army_id must not be null'
      using errcode = '22023';
  end if;

  select a.nation_id, w.status into v_nation_id, v_world_status
  from public.armies a
  inner join public.worlds w on w.id = a.world_id
  where a.id = p_army_id
  for update of a;

  if v_nation_id is null then
    raise exception 'army not found'
      using errcode = 'P0002';
  end if;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if not public.current_user_manages_nation (v_nation_id) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  if exists (select 1 from public.army_groups g where g.army_id = p_army_id)
    or exists (select 1 from public.army_units u where u.army_id = p_army_id) then
    raise exception 'army must have no groups or units before it can be deleted'
      using errcode = '22023', hint = 'army_not_empty';
  end if;

  delete from public.armies where id = p_army_id;
end;
$$;

revoke all on function public.delete_army (uuid)
from
  public;

grant
execute on function public.delete_army (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 9. create_army_group -- depth of the new group (parent's depth + 1, or 1
-- at root) must not exceed 5.
-- ---------------------------------------------------------------------------
create or replace function public.create_army_group (
  p_army_id uuid,
  p_parent_group_id uuid,
  p_name text,
  p_sort_order integer default 0
) returns public.army_groups language plpgsql security definer
set
  search_path = '' as $$
declare
  v_nation_id uuid;
  v_world_status text;
  v_parent_army_id uuid;
  v_parent_depth integer;
  v_row public.army_groups%rowtype;
begin
  if p_army_id is null or p_name is null then
    raise exception 'army and name are required'
      using errcode = '22023';
  end if;

  select a.nation_id, w.status into v_nation_id, v_world_status
  from public.armies a
  inner join public.worlds w on w.id = a.world_id
  where a.id = p_army_id
  for update of a;

  if v_nation_id is null then
    raise exception 'army not found'
      using errcode = 'P0002';
  end if;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if not public.current_user_manages_nation (v_nation_id) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  if p_parent_group_id is not null then
    select g.army_id into v_parent_army_id
    from public.army_groups g
    where g.id = p_parent_group_id;

    if v_parent_army_id is null then
      raise exception 'parent group not found'
        using errcode = 'P0002';
    end if;

    if v_parent_army_id <> p_army_id then
      raise exception 'parent group must belong to the same army'
        using errcode = '22023', hint = 'cross_army_move';
    end if;

    v_parent_depth := public.army_group_depth (p_parent_group_id);

    if v_parent_depth >= 5 then
      raise exception 'group depth cannot exceed 5 levels'
        using errcode = '22023', hint = 'depth_exceeded';
    end if;
  end if;

  insert into public.army_groups (army_id, parent_group_id, name, sort_order)
  values (p_army_id, p_parent_group_id, p_name, coalesce(p_sort_order, 0))
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_army_group (uuid, uuid, text, integer)
from
  public;

grant
execute on function public.create_army_group (uuid, uuid, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. rename_army_group
-- ---------------------------------------------------------------------------
create or replace function public.rename_army_group (p_group_id uuid, p_name text) returns public.army_groups language plpgsql security definer
set
  search_path = '' as $$
declare
  v_army_id uuid;
  v_nation_id uuid;
  v_world_status text;
  v_row public.army_groups%rowtype;
begin
  if p_group_id is null or p_name is null then
    raise exception 'group and name are required'
      using errcode = '22023';
  end if;

  select g.army_id into v_army_id from public.army_groups g where g.id = p_group_id for update of g;

  if v_army_id is null then
    raise exception 'group not found'
      using errcode = 'P0002';
  end if;

  select a.nation_id, w.status into v_nation_id, v_world_status
  from public.armies a
  inner join public.worlds w on w.id = a.world_id
  where a.id = v_army_id;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if not public.current_user_manages_nation (v_nation_id) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  update public.army_groups
  set name = p_name
  where id = p_group_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.rename_army_group (uuid, text)
from
  public;

grant
execute on function public.rename_army_group (uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 11. move_army_group -- reparent. Validates the new parent belongs to the
-- same army, is not the group itself or one of its own descendants (cycle),
-- and that no descendant ends up past the depth cap of 5.
-- ---------------------------------------------------------------------------
create or replace function public.move_army_group (p_group_id uuid, p_new_parent_group_id uuid) returns public.army_groups language plpgsql security definer
set
  search_path = '' as $$
declare
  v_army_id uuid;
  v_nation_id uuid;
  v_world_status text;
  v_new_parent_army_id uuid;
  v_new_parent_depth integer;
  v_subtree_height integer;
  v_row public.army_groups%rowtype;
begin
  if p_group_id is null then
    raise exception 'p_group_id must not be null'
      using errcode = '22023';
  end if;

  select g.army_id into v_army_id from public.army_groups g where g.id = p_group_id for update of g;

  if v_army_id is null then
    raise exception 'group not found'
      using errcode = 'P0002';
  end if;

  select a.nation_id, w.status into v_nation_id, v_world_status
  from public.armies a
  inner join public.worlds w on w.id = a.world_id
  where a.id = v_army_id;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if not public.current_user_manages_nation (v_nation_id) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  if p_new_parent_group_id = p_group_id then
    raise exception 'a group cannot be its own parent'
      using errcode = '22023', hint = 'cycle_detected';
  end if;

  if p_new_parent_group_id is not null then
    select g.army_id into v_new_parent_army_id
    from public.army_groups g
    where g.id = p_new_parent_group_id;

    if v_new_parent_army_id is null then
      raise exception 'new parent group not found'
        using errcode = 'P0002';
    end if;

    if v_new_parent_army_id <> v_army_id then
      raise exception 'new parent group must belong to the same army'
        using errcode = '22023', hint = 'cross_army_move';
    end if;

    if exists (
      with recursive descendants as (
        select id from public.army_groups where id = p_group_id
        union all
        select g.id
        from public.army_groups g
        inner join descendants d on g.parent_group_id = d.id
      )
      select 1 from descendants where id = p_new_parent_group_id
    ) then
      raise exception 'cannot move a group under one of its own descendants'
        using errcode = '22023', hint = 'cycle_detected';
    end if;

    v_new_parent_depth := public.army_group_depth (p_new_parent_group_id);
    v_subtree_height := public.army_group_subtree_height (p_group_id);

    if v_new_parent_depth + 1 + v_subtree_height > 5 then
      raise exception 'group depth cannot exceed 5 levels'
        using errcode = '22023', hint = 'depth_exceeded';
    end if;
  end if;

  update public.army_groups
  set parent_group_id = p_new_parent_group_id
  where id = p_group_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.move_army_group (uuid, uuid)
from
  public;

grant
execute on function public.move_army_group (uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 12. reorder_army_group -- change sibling sort order without reparenting.
-- ---------------------------------------------------------------------------
create or replace function public.reorder_army_group (p_group_id uuid, p_sort_order integer) returns public.army_groups language plpgsql security definer
set
  search_path = '' as $$
declare
  v_army_id uuid;
  v_nation_id uuid;
  v_world_status text;
  v_row public.army_groups%rowtype;
begin
  if p_group_id is null or p_sort_order is null then
    raise exception 'group and sort order are required'
      using errcode = '22023';
  end if;

  select g.army_id into v_army_id from public.army_groups g where g.id = p_group_id for update of g;

  if v_army_id is null then
    raise exception 'group not found'
      using errcode = 'P0002';
  end if;

  select a.nation_id, w.status into v_nation_id, v_world_status
  from public.armies a
  inner join public.worlds w on w.id = a.world_id
  where a.id = v_army_id;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if not public.current_user_manages_nation (v_nation_id) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  update public.army_groups
  set sort_order = p_sort_order
  where id = p_group_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.reorder_army_group (uuid, integer)
from
  public;

grant
execute on function public.reorder_army_group (uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 13. delete_army_group -- only when empty of child groups and units.
-- ---------------------------------------------------------------------------
create or replace function public.delete_army_group (p_group_id uuid) returns void language plpgsql security definer
set
  search_path = '' as $$
declare
  v_army_id uuid;
  v_nation_id uuid;
  v_world_status text;
begin
  if p_group_id is null then
    raise exception 'p_group_id must not be null'
      using errcode = '22023';
  end if;

  select g.army_id into v_army_id from public.army_groups g where g.id = p_group_id for update of g;

  if v_army_id is null then
    raise exception 'group not found'
      using errcode = 'P0002';
  end if;

  select a.nation_id, w.status into v_nation_id, v_world_status
  from public.armies a
  inner join public.worlds w on w.id = a.world_id
  where a.id = v_army_id;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if not public.current_user_manages_nation (v_nation_id) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  if exists (select 1 from public.army_groups g where g.parent_group_id = p_group_id)
    or exists (select 1 from public.army_units u where u.group_id = p_group_id) then
    raise exception 'group must have no child groups or units before it can be deleted'
      using errcode = '22023', hint = 'group_not_empty';
  end if;

  delete from public.army_groups where id = p_group_id;
end;
$$;

revoke all on function public.delete_army_group (uuid)
from
  public;

grant
execute on function public.delete_army_group (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 14. create_army_unit
-- ---------------------------------------------------------------------------
create or replace function public.create_army_unit (
  p_army_id uuid,
  p_group_id uuid,
  p_unit_type_id uuid,
  p_name text,
  p_sort_order integer default 0
) returns public.army_units language plpgsql security definer
set
  search_path = '' as $$
declare
  v_nation_id uuid;
  v_world_id uuid;
  v_world_status text;
  v_turn_number integer;
  v_group_army_id uuid;
  v_row public.army_units%rowtype;
begin
  if p_army_id is null or p_unit_type_id is null or p_name is null then
    raise exception 'army, unit type, and name are required'
      using errcode = '22023';
  end if;

  select a.nation_id, a.world_id, w.status, w.current_turn_number
  into v_nation_id, v_world_id, v_world_status, v_turn_number
  from public.armies a
  inner join public.worlds w on w.id = a.world_id
  where a.id = p_army_id
  for update of a;

  if v_nation_id is null then
    raise exception 'army not found'
      using errcode = 'P0002';
  end if;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if not public.current_user_manages_nation (v_nation_id) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.unit_types ut where ut.id = p_unit_type_id and ut.world_id = v_world_id
  ) then
    raise exception 'unit type not found in this world'
      using errcode = 'P0002';
  end if;

  if p_group_id is not null then
    select g.army_id into v_group_army_id from public.army_groups g where g.id = p_group_id;

    if v_group_army_id is null then
      raise exception 'group not found'
        using errcode = 'P0002';
    end if;

    if v_group_army_id <> p_army_id then
      raise exception 'group must belong to the same army'
        using errcode = '22023', hint = 'cross_army_move';
    end if;
  end if;

  insert into public.army_units (
    army_id, group_id, unit_type_id, name, sort_order, created_turn_number
  )
  values (
    p_army_id, p_group_id, p_unit_type_id, p_name, coalesce(p_sort_order, 0), v_turn_number
  )
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.create_army_unit (uuid, uuid, uuid, text, integer)
from
  public;

grant
execute on function public.create_army_unit (uuid, uuid, uuid, text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 15. rename_army_unit
-- ---------------------------------------------------------------------------
create or replace function public.rename_army_unit (p_unit_id uuid, p_name text) returns public.army_units language plpgsql security definer
set
  search_path = '' as $$
declare
  v_army_id uuid;
  v_nation_id uuid;
  v_world_status text;
  v_row public.army_units%rowtype;
begin
  if p_unit_id is null or p_name is null then
    raise exception 'unit and name are required'
      using errcode = '22023';
  end if;

  select u.army_id into v_army_id from public.army_units u where u.id = p_unit_id for update of u;

  if v_army_id is null then
    raise exception 'unit not found'
      using errcode = 'P0002';
  end if;

  select a.nation_id, w.status into v_nation_id, v_world_status
  from public.armies a
  inner join public.worlds w on w.id = a.world_id
  where a.id = v_army_id;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if not public.current_user_manages_nation (v_nation_id) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  update public.army_units
  set name = p_name
  where id = p_unit_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.rename_army_unit (uuid, text)
from
  public;

grant
execute on function public.rename_army_unit (uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 16. move_army_unit -- change group placement (null = army root) and/or
-- sibling sort order in one call. New group (when set) must belong to the
-- same army as the unit.
-- ---------------------------------------------------------------------------
create or replace function public.move_army_unit (
  p_unit_id uuid,
  p_group_id uuid,
  p_sort_order integer
) returns public.army_units language plpgsql security definer
set
  search_path = '' as $$
declare
  v_army_id uuid;
  v_nation_id uuid;
  v_world_status text;
  v_group_army_id uuid;
  v_row public.army_units%rowtype;
begin
  if p_unit_id is null or p_sort_order is null then
    raise exception 'unit and sort order are required'
      using errcode = '22023';
  end if;

  select u.army_id into v_army_id from public.army_units u where u.id = p_unit_id for update of u;

  if v_army_id is null then
    raise exception 'unit not found'
      using errcode = 'P0002';
  end if;

  select a.nation_id, w.status into v_nation_id, v_world_status
  from public.armies a
  inner join public.worlds w on w.id = a.world_id
  where a.id = v_army_id;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if not public.current_user_manages_nation (v_nation_id) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  if p_group_id is not null then
    select g.army_id into v_group_army_id from public.army_groups g where g.id = p_group_id;

    if v_group_army_id is null then
      raise exception 'group not found'
        using errcode = 'P0002';
    end if;

    if v_group_army_id <> v_army_id then
      raise exception 'group must belong to the same army'
        using errcode = '22023', hint = 'cross_army_move';
    end if;
  end if;

  update public.army_units
  set group_id = p_group_id, sort_order = p_sort_order
  where id = p_unit_id
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.move_army_unit (uuid, uuid, integer)
from
  public;

grant
execute on function public.move_army_unit (uuid, uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 17. delete_army_unit -- soldier tracking doesn't exist yet (see the
-- migration header), so a unit can never hold soldiers today and this guard
-- is a structural no-op until the recruitment issue adds that column.
-- ---------------------------------------------------------------------------
create or replace function public.delete_army_unit (p_unit_id uuid) returns void language plpgsql security definer
set
  search_path = '' as $$
declare
  v_army_id uuid;
  v_nation_id uuid;
  v_world_status text;
begin
  if p_unit_id is null then
    raise exception 'p_unit_id must not be null'
      using errcode = '22023';
  end if;

  select u.army_id into v_army_id from public.army_units u where u.id = p_unit_id for update of u;

  if v_army_id is null then
    raise exception 'unit not found'
      using errcode = 'P0002';
  end if;

  select a.nation_id, w.status into v_nation_id, v_world_status
  from public.armies a
  inner join public.worlds w on w.id = a.world_id
  where a.id = v_army_id;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if not public.current_user_manages_nation (v_nation_id) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  delete from public.army_units where id = p_unit_id;
end;
$$;

revoke all on function public.delete_army_unit (uuid)
from
  public;

grant
execute on function public.delete_army_unit (uuid) to authenticated;
