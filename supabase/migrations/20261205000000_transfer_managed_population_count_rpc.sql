-- Migration: transfer_managed_population_count_rpc
-- SECURITY DEFINER RPC that atomically moves headcount between two managed
-- population instances of the same type in the same settlement.
--
-- Authorised callers: settlement_manager, nation_manager, world_admin,
-- super_admin (resolved via current_user_manages_settlement on the source
-- instance's settlement).
--
-- Error contract:
--   P0002 (no_data_found)          – either instance id is null or not found
--   42501 (insufficient_privilege) – caller lacks manage-settlement permission
--   P0001 (raise_exception)        – world is archived, p_count <= 0, instances
--                                    are the same, belong to different
--                                    settlements or types, either instance is
--                                    not active, or p_count exceeds source
--                                    current_count
-- ---------------------------------------------------------------------------
create or replace function public.transfer_managed_population_count (
  p_from_instance_id uuid,
  p_to_instance_id uuid,
  p_count numeric
) returns table (
  from_instance_id uuid,
  to_instance_id uuid,
  settlement_id uuid
) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_from_settlement_id uuid;
  v_to_settlement_id   uuid;
  v_from_type_id       uuid;
  v_to_type_id         uuid;
  v_from_status        text;
  v_to_status          text;
  v_from_count         numeric;
  v_world_id           uuid;
begin
  -- Null guards
  if p_from_instance_id is null or p_to_instance_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_from_instance_id = p_to_instance_id then
    raise exception 'cannot transfer to the same managed population instance' using errcode = 'P0001';
  end if;

  -- Validate count > 0
  if p_count is null or p_count <= 0 then
    raise exception 'transfer count must be greater than 0' using errcode = 'P0001';
  end if;

  -- Resolve both instances
  select mpi.settlement_id, mpi.managed_population_type_id, mpi.status, mpi.current_count
    into v_from_settlement_id, v_from_type_id, v_from_status, v_from_count
    from public.managed_population_instances mpi
   where mpi.id = p_from_instance_id;

  select mpi.settlement_id, mpi.managed_population_type_id, mpi.status
    into v_to_settlement_id, v_to_type_id, v_to_status
    from public.managed_population_instances mpi
   where mpi.id = p_to_instance_id;

  if v_from_settlement_id is null or v_to_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Resolve world_id for archived check
  select n.world_id
    into v_world_id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
   where s.id = v_from_settlement_id;

  -- Archived world guard
  if public.world_is_archived (v_world_id) then
    raise exception 'world is archived' using errcode = 'P0001';
  end if;

  -- Auth: settlement manager, nation manager, world admin, or super admin
  -- of the source instance's settlement
  if not public.current_user_manages_settlement (v_from_settlement_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Both instances must belong to the same settlement
  if v_from_settlement_id is distinct from v_to_settlement_id then
    raise exception 'managed population instances must belong to the same settlement' using errcode = 'P0001';
  end if;

  -- Both instances must be the same managed population type
  if v_from_type_id is distinct from v_to_type_id then
    raise exception 'managed population instances must be the same type' using errcode = 'P0001';
  end if;

  -- Both instances must be active
  if v_from_status <> 'active' or v_to_status <> 'active' then
    raise exception 'managed population instances must be active' using errcode = 'P0001';
  end if;

  -- Cannot transfer more than the source currently has
  if p_count > v_from_count then
    raise exception 'transfer count must not exceed source current count' using errcode = 'P0001';
  end if;

  update public.managed_population_instances
     set current_count = current_count - p_count
   where id = p_from_instance_id;

  update public.managed_population_instances
     set current_count = current_count + p_count
   where id = p_to_instance_id;

  from_instance_id := p_from_instance_id;
  to_instance_id   := p_to_instance_id;
  settlement_id    := v_from_settlement_id;
  return next;
end;
$$;

revoke all on function public.transfer_managed_population_count (uuid, uuid, numeric)
from
  public;

grant
execute on function public.transfer_managed_population_count (uuid, uuid, numeric) to authenticated;
