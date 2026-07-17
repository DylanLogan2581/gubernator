-- Migration: enforce_one_settlement_manager
-- assign_citizen_role did not demote an existing settlement_manager of the
-- same settlement, so two citizens could simultaneously hold the role for
-- one settlement. Adds a partial unique index as the database-level
-- guarantee, and makes assign_citizen_role demote the prior manager (setting
-- their role back to 'none') as part of the same update so the RPC never
-- violates it.
-- ---------------------------------------------------------------------------
-- Guarantees at most one settlement_manager per settlement.
create unique index citizens_one_manager_per_settlement_idx on public.citizens (role_settlement_id)
where
  role_type = 'settlement_manager';

-- ---------------------------------------------------------------------------
-- assign_citizen_role
-- Error contract:
--   P0002 – p_citizen_id or p_role_type is null; citizen not found;
--            settlement's nation not found
--   42501 – caller lacks the required admin or nation-manager rights
--   P0001 – invalid role_type; citizen has no settlement; citizen must be
--            alive; archived world; role scope mismatch
-- Behavior change: when assigning settlement_manager, any other citizen
-- currently holding settlement_manager for the same settlement is demoted
-- to 'none' in the same transaction, so the partial unique index on
-- (role_settlement_id) where role_type = 'settlement_manager' is never
-- violated.
-- ---------------------------------------------------------------------------
create or replace function public.assign_citizen_role (
  p_citizen_id uuid,
  p_role_type text,
  p_role_nation_id uuid default null,
  p_role_settlement_id uuid default null
) returns setof public.citizens language plpgsql security definer
set
  search_path = '' as $$
declare
  v_citizen public.citizens%rowtype;
  v_settlement_nation_id uuid;
  v_world_status text;
  v_world_archived_at timestamptz;
  v_is_world_admin boolean;
begin
  if p_citizen_id is null or p_role_type is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_role_type not in ('nation_manager', 'settlement_manager') then
    raise exception 'invalid role type' using errcode = 'P0001';
  end if;

  select * into v_citizen from public.citizens where id = p_citizen_id;
  if v_citizen.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_citizen.status <> 'alive' then
    raise exception 'citizen must be alive to hold a manager role' using errcode = 'P0001';
  end if;

  if v_citizen.settlement_id is null then
    raise exception 'citizen has no settlement' using errcode = 'P0001';
  end if;

  select s.nation_id into v_settlement_nation_id
  from public.settlements s
  where s.id = v_citizen.settlement_id;

  if v_settlement_nation_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  v_is_world_admin :=
    public.is_super_admin ()
    or public.is_world_admin (v_citizen.world_id);

  if not v_is_world_admin then
    if p_role_type <> 'settlement_manager' then
      raise exception 'insufficient privilege' using errcode = '42501';
    end if;
    if not public.is_nation_manager_of (v_settlement_nation_id) then
      raise exception 'insufficient privilege' using errcode = '42501';
    end if;
  end if;

  select w.status, w.archived_at
  into v_world_status, v_world_archived_at
  from public.worlds w
  where w.id = v_citizen.world_id;

  if v_world_status = 'archived' or v_world_archived_at is not null then
    raise exception 'world is archived' using errcode = 'P0001';
  end if;

  if not public.citizen_role_scope_matches (
    v_citizen.settlement_id,
    p_role_type,
    p_role_nation_id,
    p_role_settlement_id
  ) then
    raise exception 'role scope does not match citizen settlement or nation' using errcode = 'P0001';
  end if;

  if p_role_type = 'settlement_manager' then
    update public.citizens c
    set
      role_type = 'none',
      role_nation_id = null,
      role_settlement_id = null
    where c.role_type = 'settlement_manager'
      and c.role_settlement_id = p_role_settlement_id
      and c.id <> p_citizen_id;
  end if;

  return query
  update public.citizens c
  set
    role_type = p_role_type,
    role_nation_id = p_role_nation_id,
    role_settlement_id = p_role_settlement_id
  where c.id = p_citizen_id
  returning c.*;
end;
$$;
