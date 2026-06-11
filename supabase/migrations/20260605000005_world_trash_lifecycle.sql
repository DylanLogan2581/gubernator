-- Migration: world_trash_lifecycle
-- Adds is_trashed boolean column to worlds and four super-admin-only RPCs:
-- create_world, trash_world, restore_world, hard_delete_world.
--
-- Design notes:
--   - is_trashed is distinct from status/archived_at (housekeeping vs in-game state).
--   - All four RPCs are SECURITY DEFINER, is_super_admin() only.
--   - trash_world also marks any running turn transitions as failed.
--   - hard_delete_world requires is_trashed = true; cascading FKs remove child rows.
-- ---------------------------------------------------------------------------
-- ===========================================================================
-- 1. Schema change
-- ===========================================================================
alter table public.worlds
add column is_trashed boolean not null default false;

create index worlds_active_idx on public.worlds (id)
where
  is_trashed = false;

-- ===========================================================================
-- 2. create_world
-- ===========================================================================
create or replace function public.create_world (p_name text, p_visibility text default 'private') returns setof public.worlds language plpgsql security definer
set
  search_path = '' as $$
begin
  if not public.is_super_admin () then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if p_name is null or char_length (trim (p_name)) = 0 then
    raise exception 'World name is required.' using errcode = '22000';
  end if;

  if p_visibility not in ('public', 'private') then
    raise exception 'Visibility must be public or private.' using errcode = '22000';
  end if;

  return query
  insert into public.worlds (name, owner_id, visibility)
  values (trim (p_name), public.current_app_user_id (), p_visibility)
  returning *;
end;
$$;

-- ===========================================================================
-- 3. trash_world
-- ===========================================================================
create or replace function public.trash_world (p_world_id uuid) returns setof public.worlds language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world public.worlds%rowtype;
begin
  if p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select *
  into v_world
  from public.worlds w
  where w.id = p_world_id
  for update;

  if v_world.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not public.is_super_admin () then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  -- Idempotent no-op.
  if v_world.is_trashed then
    return query
    select * from public.worlds w where w.id = p_world_id;
    return;
  end if;

  -- Mark any in-flight turn transitions as failed.
  update public.turn_transitions tt
  set
    status = 'failed',
    finished_at = now ()
  where tt.world_id = p_world_id
    and tt.status = 'running';

  return query
  update public.worlds w
  set
    is_trashed = true,
    updated_at = now ()
  where w.id = p_world_id
  returning *;
end;
$$;

-- ===========================================================================
-- 4. restore_world
-- ===========================================================================
create or replace function public.restore_world (p_world_id uuid) returns setof public.worlds language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world public.worlds%rowtype;
begin
  if p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select *
  into v_world
  from public.worlds w
  where w.id = p_world_id
  for update;

  if v_world.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not public.is_super_admin () then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  -- Idempotent no-op.
  if not v_world.is_trashed then
    return query
    select * from public.worlds w where w.id = p_world_id;
    return;
  end if;

  return query
  update public.worlds w
  set
    is_trashed = false,
    updated_at = now ()
  where w.id = p_world_id
  returning *;
end;
$$;

-- ===========================================================================
-- 5. hard_delete_world
-- ===========================================================================
create or replace function public.hard_delete_world (p_world_id uuid) returns table (id uuid) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world public.worlds%rowtype;
begin
  if p_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select *
  into v_world
  from public.worlds w
  where w.id = p_world_id
  for update;

  if v_world.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not public.is_super_admin () then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if not v_world.is_trashed then
    raise exception 'World must be trashed before it can be permanently deleted.';
  end if;

  return query
  delete from public.worlds w
  where w.id = p_world_id
  returning w.id;
end;
$$;

-- ===========================================================================
-- 6. Permissions
-- ===========================================================================
revoke all on function public.create_world (text, text)
from
  public;

revoke all on function public.trash_world (uuid)
from
  public;

revoke all on function public.restore_world (uuid)
from
  public;

revoke all on function public.hard_delete_world (uuid)
from
  public;

grant
execute on function public.create_world (text, text) to authenticated;

grant
execute on function public.trash_world (uuid) to authenticated;

grant
execute on function public.restore_world (uuid) to authenticated;

grant
execute on function public.hard_delete_world (uuid) to authenticated;
