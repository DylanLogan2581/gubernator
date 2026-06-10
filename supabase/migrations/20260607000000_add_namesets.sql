-- Migration: add_namesets
-- Introduces the namesets table to bundle naming pools + convention into named
-- configurations that can be assigned per-world (default), per-nation, or
-- per-settlement, giving world admins cultural naming variety across regions.
--
-- Resolution hierarchy: settlement.nameset_id ?? nation.nameset_id ?? world default nameset
--
-- §1  Create namesets table
-- §2  Add nameset_id FK to nations and settlements
-- §3  Partial unique index for is_default
-- §4  Constraints, RLS, and column grants
-- §5  Seed one nameset per existing world from naming_config_json
-- §6  RPCs: create, update, soft_delete, restore, hard_delete, set_default
-- §7  RPCs: set_nation_nameset, set_settlement_nameset
-- ---------------------------------------------------------------------------
-- §1: Create namesets table.
create table public.namesets (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  name text not null,
  config_json jsonb not null default public.default_naming_config (),
  is_default boolean not null default false,
  is_trashed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger namesets_set_updated_at before
update on public.namesets for each row
execute function public.set_updated_at ();

-- §2: Add nameset_id FK to nations and settlements.
alter table public.nations
add column nameset_id uuid references public.namesets (id) on delete set null;

alter table public.settlements
add column nameset_id uuid references public.namesets (id) on delete set null;

-- §3: Partial unique index — at most one active default per world.
create unique index namesets_world_default_unique on public.namesets (world_id)
where
  (
    is_default = true
    and is_trashed = false
  );

-- General covering index for world_id lookups and ON DELETE CASCADE.
create index namesets_world_id_idx on public.namesets (world_id);

-- §4: Constraints, RLS, and column grants.
alter table public.namesets
add constraint namesets_name_length_check check (char_length(btrim(name)) >= 1),
add constraint namesets_name_max_length_check check (char_length(name) <= 64),
add constraint namesets_config_json_check check (public.is_valid_naming_config (config_json));

alter table public.namesets enable row level security;

create policy "namesets_select_world_access" on public.namesets for
select
  to authenticated using (public.has_world_access (world_id));

create policy "namesets_insert_world_admin" on public.namesets for insert to authenticated
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

create policy "namesets_update_world_admin" on public.namesets
for update
  to authenticated using (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  )
with
  check (
    public.is_world_admin (world_id)
    or public.is_super_admin ()
  );

create policy "namesets_delete_world_admin" on public.namesets for delete to authenticated using (
  public.is_world_admin (world_id)
  or public.is_super_admin ()
);

-- Column grants for authenticated direct-write operations.
grant insert (world_id, name, config_json) on public.namesets to authenticated;

grant
update (name, config_json) on public.namesets to authenticated;

-- §5: Seed one default nameset per existing world from naming_config_json.
insert into
  public.namesets (world_id, name, config_json, is_default)
select
  id,
  'Default',
  naming_config_json,
  true
from
  public.worlds
where
  naming_config_json is not null;

-- ---------------------------------------------------------------------------
-- §6: Nameset CRUD and trash lifecycle RPCs.
-- All RPCs follow the standardized error contract:
--   P0002 (no_data_found)          – row does not exist or params are null
--   42501 (insufficient_privilege) – caller lacks super_admin / world_admin
--   P0001 (raise_exception)        – business constraint violation
-- ---------------------------------------------------------------------------
create or replace function public.soft_delete_nameset (p_nameset_id uuid, p_world_id uuid) returns table (id uuid, world_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_nameset public.namesets%rowtype;
begin
  if p_nameset_id is null or p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_nameset
  from public.namesets
  where namesets.id = p_nameset_id and namesets.world_id = p_world_id
  for update;

  if v_nameset.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if v_nameset.is_default and not v_nameset.is_trashed then
    raise exception 'Cannot trash the world default nameset. Set another nameset as default first.'
      using errcode = 'P0001';
  end if;

  if v_nameset.is_trashed then
    return query select v_nameset.id, v_nameset.world_id;
    return;
  end if;

  return query
  update public.namesets
  set is_trashed = true, updated_at = now()
  where namesets.id = p_nameset_id and namesets.world_id = p_world_id
  returning namesets.id, namesets.world_id;
end;
$$;

revoke all on function public.soft_delete_nameset (uuid, uuid)
from
  public;

grant
execute on function public.soft_delete_nameset (uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
create or replace function public.restore_nameset (p_nameset_id uuid, p_world_id uuid) returns table (id uuid, world_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_nameset public.namesets%rowtype;
begin
  if p_nameset_id is null or p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_nameset
  from public.namesets
  where namesets.id = p_nameset_id and namesets.world_id = p_world_id
  for update;

  if v_nameset.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if not v_nameset.is_trashed then
    return query select v_nameset.id, v_nameset.world_id;
    return;
  end if;

  return query
  update public.namesets
  set is_trashed = false, updated_at = now()
  where namesets.id = p_nameset_id and namesets.world_id = p_world_id
  returning namesets.id, namesets.world_id;
end;
$$;

revoke all on function public.restore_nameset (uuid, uuid)
from
  public;

grant
execute on function public.restore_nameset (uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
create or replace function public.hard_delete_nameset (p_nameset_id uuid, p_world_id uuid) returns table (id uuid, world_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_nameset public.namesets%rowtype;
begin
  if p_nameset_id is null or p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_nameset
  from public.namesets
  where namesets.id = p_nameset_id and namesets.world_id = p_world_id
  for update;

  if v_nameset.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if not v_nameset.is_trashed then
    raise exception 'Nameset must be trashed before it can be permanently deleted.'
      using errcode = 'P0001';
  end if;

  delete from public.namesets
  where namesets.id = p_nameset_id and namesets.world_id = p_world_id;

  return query select p_nameset_id, p_world_id;
end;
$$;

revoke all on function public.hard_delete_nameset (uuid, uuid)
from
  public;

grant
execute on function public.hard_delete_nameset (uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
create or replace function public.set_world_default_nameset (p_nameset_id uuid, p_world_id uuid) returns table (id uuid, world_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_nameset public.namesets%rowtype;
begin
  if p_nameset_id is null or p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select * into v_nameset
  from public.namesets
  where namesets.id = p_nameset_id and namesets.world_id = p_world_id
  for update;

  if v_nameset.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if v_nameset.is_trashed then
    raise exception 'Cannot set a trashed nameset as the world default.'
      using errcode = 'P0001';
  end if;

  -- Atomically clear the old default and set the new one.
  update public.namesets
  set is_default = false, updated_at = now()
  where namesets.world_id = p_world_id
    and namesets.is_default = true
    and namesets.id <> p_nameset_id;

  update public.namesets
  set is_default = true, updated_at = now()
  where namesets.id = p_nameset_id and namesets.world_id = p_world_id;

  return query select p_nameset_id, p_world_id;
end;
$$;

revoke all on function public.set_world_default_nameset (uuid, uuid)
from
  public;

grant
execute on function public.set_world_default_nameset (uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- §7: Entity nameset assignment RPCs (nation and settlement).
-- ---------------------------------------------------------------------------
create or replace function public.set_nation_nameset (
  p_nation_id uuid,
  p_world_id uuid,
  p_nameset_id uuid -- null to clear the override
) returns table (id uuid, world_id uuid, nameset_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_status text;
  v_nation_world_id uuid;
begin
  if p_nation_id is null or p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select n.world_id into v_nation_world_id
  from public.nations n
  where n.id = p_nation_id;

  if v_nation_world_id is null or v_nation_world_id <> p_world_id then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  select w.status into v_world_status from public.worlds w where w.id = p_world_id;
  if v_world_status = 'archived' then
    raise exception 'World is archived.' using errcode = 'P0001';
  end if;

  -- Validate nameset belongs to the same world (if not null).
  if p_nameset_id is not null then
    if not exists (
      select 1 from public.namesets ns
      where ns.id = p_nameset_id and ns.world_id = p_world_id and not ns.is_trashed
    ) then
      raise exception 'not found' using errcode = 'P0002';
    end if;
  end if;

  update public.nations
  set nameset_id = p_nameset_id, updated_at = now()
  where nations.id = p_nation_id;

  return query select p_nation_id, p_world_id, p_nameset_id;
end;
$$;

revoke all on function public.set_nation_nameset (uuid, uuid, uuid)
from
  public;

grant
execute on function public.set_nation_nameset (uuid, uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
create or replace function public.set_settlement_nameset (
  p_settlement_id uuid,
  p_world_id uuid,
  p_nameset_id uuid -- null to clear the override
) returns table (id uuid, world_id uuid, nameset_id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_status text;
  v_settlement_world_id uuid;
begin
  if p_settlement_id is null or p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select n.world_id into v_settlement_world_id
  from public.settlements s
  inner join public.nations n on n.id = s.nation_id
  where s.id = p_settlement_id;

  if v_settlement_world_id is null or v_settlement_world_id <> p_world_id then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  select w.status into v_world_status from public.worlds w where w.id = p_world_id;
  if v_world_status = 'archived' then
    raise exception 'World is archived.' using errcode = 'P0001';
  end if;

  -- Validate nameset belongs to the same world (if not null).
  if p_nameset_id is not null then
    if not exists (
      select 1 from public.namesets ns
      where ns.id = p_nameset_id and ns.world_id = p_world_id and not ns.is_trashed
    ) then
      raise exception 'not found' using errcode = 'P0002';
    end if;
  end if;

  update public.settlements
  set nameset_id = p_nameset_id, updated_at = now()
  where settlements.id = p_settlement_id;

  return query select p_settlement_id, p_world_id, p_nameset_id;
end;
$$;

revoke all on function public.set_settlement_nameset (uuid, uuid, uuid)
from
  public;

grant
execute on function public.set_settlement_nameset (uuid, uuid, uuid) to authenticated;
