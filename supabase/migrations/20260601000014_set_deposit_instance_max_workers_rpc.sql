-- Migration: set_deposit_instance_max_workers_rpc
-- SECURITY DEFINER RPC that updates max_workers on a deposit instance and,
-- when the new cap is lower than the current assigned count, auto-unassigns
-- the excess citizen_assignments rows in the same transaction.
--
-- Authorised callers: settlement_manager, nation_manager, world_admin,
-- super_admin (resolved via current_user_manages_settlement).
--
-- Error contract:
--   P0002 (no_data_found)          – p_deposit_instance_id is null or not found
--   42501 (insufficient_privilege) – caller lacks manage-settlement permission
--   P0001 (raise_exception)        – world is archived, p_max_workers <= 0, p_removal_strategy
--                                    invalid, or strategy omitted when shrinking
--
-- Removal strategies (consulted only when shrinking):
--   npc_first – NPCs removed before player characters; stable citizen_id
--               tiebreak within each tier.
--   random    – deterministic-random within the transaction via
--               setseed(frac(epoch)); PC-last invariant applies.
-- ---------------------------------------------------------------------------
create or replace function public.set_deposit_instance_max_workers (
  p_deposit_instance_id uuid,
  p_max_workers integer,
  p_removal_strategy text
) returns table (
  max_workers integer,
  unassigned_citizen_ids uuid[]
) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_settlement_id  uuid;
  v_world_id       uuid;
  v_current_count  integer;
  v_excess         integer;
  v_new_max        integer;
  v_unassigned     uuid[];
begin
  -- Null guard
  if p_deposit_instance_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Validate p_max_workers > 0 when not null
  if p_max_workers is not null and p_max_workers <= 0 then
    raise exception 'max_workers must be positive when set' using errcode = 'P0001';
  end if;

  -- Validate p_removal_strategy when not null
  if p_removal_strategy is not null
     and p_removal_strategy not in ('npc_first', 'random') then
    raise exception 'removal_strategy must be npc_first or random' using errcode = 'P0001';
  end if;

  -- Resolve deposit instance → settlement
  select di.settlement_id
    into v_settlement_id
    from public.deposit_instances di
   where di.id = p_deposit_instance_id;

  if v_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Resolve world_id for archived check
  select n.world_id
    into v_world_id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
   where s.id = v_settlement_id;

  -- Archived world guard
  if public.world_is_archived(v_world_id) then
    raise exception 'world is archived' using errcode = 'P0001';
  end if;

  -- Auth: settlement manager, nation manager, world admin, or super admin
  if not public.current_user_manages_settlement (v_settlement_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Apply new max_workers
  update public.deposit_instances di
     set max_workers = p_max_workers
   where di.id = p_deposit_instance_id
   returning di.max_workers into v_new_max;

  -- Count currently assigned workers for this deposit
  select count(*)
    into v_current_count
    from public.citizen_assignments ca
   where ca.deposit_instance_id = p_deposit_instance_id
     and ca.assignment_type = 'deposit';

  -- No shrink needed: cap is null (unlimited) or not exceeded
  if p_max_workers is null or v_current_count <= p_max_workers then
    max_workers            := v_new_max;
    unassigned_citizen_ids := array[]::uuid[];
    return next;
    return;
  end if;

  -- Shrink needed: strategy is required
  if p_removal_strategy is null then
    raise exception 'removal_strategy is required when shrinking worker count'
      using errcode = 'P0001';
  end if;

  v_excess := v_current_count - p_max_workers;

  if p_removal_strategy = 'npc_first' then
    -- NPCs first, then PCs; stable citizen_id tiebreak within each tier
    select array_agg(t.citizen_id)
      into v_unassigned
      from (
        select ca.citizen_id
          from public.citizen_assignments ca
          join public.citizens c on c.id = ca.citizen_id
         where ca.deposit_instance_id = p_deposit_instance_id
           and ca.assignment_type = 'deposit'
         order by (c.citizen_type = 'player_character')::int asc,
                  ca.citizen_id asc
         limit v_excess
      ) t;
  else
    -- random: deterministic within transaction via fractional epoch seed;
    -- PC-last invariant preserved by the citizen_type sort tier
    perform setseed(
      extract(epoch from now())::numeric
      - floor(extract(epoch from now())::numeric)
    );
    select array_agg(t.citizen_id)
      into v_unassigned
      from (
        select ca.citizen_id
          from public.citizen_assignments ca
          join public.citizens c on c.id = ca.citizen_id
         where ca.deposit_instance_id = p_deposit_instance_id
           and ca.assignment_type = 'deposit'
         order by (c.citizen_type = 'player_character')::int asc,
                  random() asc
         limit v_excess
      ) t;
  end if;

  -- Remove the selected assignments
  delete from public.citizen_assignments ca
   where ca.citizen_id = any (v_unassigned);

  max_workers            := v_new_max;
  unassigned_citizen_ids := coalesce(v_unassigned, array[]::uuid[]);
  return next;
end;
$$;

revoke all on function public.set_deposit_instance_max_workers (uuid, integer, text)
from
  public;

grant
execute on function public.set_deposit_instance_max_workers (uuid, integer, text) to authenticated;
