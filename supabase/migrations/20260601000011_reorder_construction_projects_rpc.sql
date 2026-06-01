-- Migration: reorder_construction_projects_rpc
-- SECURITY DEFINER RPC that reorders the non-terminal construction project queue
-- for a settlement. Callers must supply a complete permutation of all non-terminal
-- projects; partial reorders are rejected to prevent queue corruption.
--
-- Authorized callers: settlement_manager, nation_manager, world_admin, super_admin
-- (resolved via current_user_manages_settlement).
--
-- Error contract:
--   P0002 (no_data_found)          – null params or settlement not found
--   42501 (insufficient_privilege) – caller lacks manage-settlement permission
--   P0001 (raise_exception)        – positions list is invalid (gaps, duplicates,
--                                    partial coverage, terminal or foreign project ids)
--
-- Two-step write strategy:
--   The partial unique index on (settlement_id, queue_position) WHERE status IN
--   ('queued','in_progress','paused') would produce transient uniqueness violations
--   if rows were updated one-by-one with target positions already held by other rows.
--   We avoid this by updating in two passes:
--     Step 1 – shift all non-terminal rows to temporary positions in the range
--              [N+1, 2N], which is disjoint from the target range [1, N]. This
--              satisfies the queue_position >= 1 check constraint while vacating
--              the [1, N] band entirely.
--     Step 2 – write the final target positions from p_positions.
--   Using positive offsets (rather than negative values) preserves the
--   queue_position >= 1 invariant throughout the transaction.
-- ---------------------------------------------------------------------------
create or replace function public.reorder_construction_projects (p_settlement_id uuid, p_positions jsonb) returns table (updated_count integer) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_non_terminal_count integer;
  v_position_count     integer;
  v_duplicate_count    integer;
  v_out_of_range_count integer;
  v_mismatched_count   integer;
begin
  -- Null guard
  if p_settlement_id is null or p_positions is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Auth: settlement manager, nation manager, world admin, or super admin
  if not public.current_user_manages_settlement (p_settlement_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Verify settlement exists (manages_settlement returns false for unknown ids,
  -- but also for anon; a dedicated existence check surfaces a cleaner P0002)
  if not exists (
    select 1 from public.settlements where id = p_settlement_id
  ) then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Count non-terminal projects for this settlement
  select count(*)
  into v_non_terminal_count
  from public.construction_projects
  where settlement_id = p_settlement_id
    and status in ('queued', 'in_progress', 'paused');

  -- Positions array length must equal the non-terminal project count
  select jsonb_array_length(p_positions)
  into v_position_count;

  if v_position_count != v_non_terminal_count then
    raise exception 'positions list must include every non-terminal project (expected %, got %)',
      v_non_terminal_count, v_position_count
      using errcode = 'P0001';
  end if;

  -- Early exit for empty queues (no-op, return 0)
  if v_non_terminal_count = 0 then
    return query select 0;
    return;
  end if;

  -- Validate: no duplicate project IDs in positions input
  select count(*) - count(distinct (e ->> 'projectId')::uuid)
  into v_duplicate_count
  from jsonb_array_elements(p_positions) e;

  if v_duplicate_count > 0 then
    raise exception 'positions list contains duplicate project ids'
      using errcode = 'P0001';
  end if;

  -- Validate: positions form a contiguous 1..N permutation (no gaps, no out-of-range)
  select count(*)
  into v_out_of_range_count
  from jsonb_array_elements(p_positions) e
  where (e ->> 'position')::integer not between 1 and v_non_terminal_count;

  if v_out_of_range_count > 0 then
    raise exception 'positions must be a contiguous 1..N permutation (N=%)',
      v_non_terminal_count
      using errcode = 'P0001';
  end if;

  -- Validate: no duplicate positions
  select count(*) - count(distinct (e ->> 'position')::integer)
  into v_duplicate_count
  from jsonb_array_elements(p_positions) e;

  if v_duplicate_count > 0 then
    raise exception 'positions list contains duplicate position values'
      using errcode = 'P0001';
  end if;

  -- Validate: every projectId belongs to this settlement and is non-terminal
  select count(*)
  into v_mismatched_count
  from jsonb_array_elements(p_positions) e
  where not exists (
    select 1
    from public.construction_projects cp
    where cp.id = (e ->> 'projectId')::uuid
      and cp.settlement_id = p_settlement_id
      and cp.status in ('queued', 'in_progress', 'paused')
  );

  if v_mismatched_count > 0 then
    raise exception 'one or more project ids are not valid non-terminal projects for this settlement'
      using errcode = 'P0001';
  end if;

  -- Step 1: shift all non-terminal rows to temporary positions in [N+1, 2N].
  -- This vacates the target range [1, N] while keeping all values positive,
  -- satisfying the queue_position >= 1 constraint.
  update public.construction_projects cp
  set queue_position = subq.tmp_pos
  from (
    select
      id,
      v_non_terminal_count + row_number() over (order by queue_position) as tmp_pos
    from public.construction_projects
    where settlement_id = p_settlement_id
      and status in ('queued', 'in_progress', 'paused')
  ) subq
  where cp.id = subq.id;

  -- Step 2: apply the requested target positions from p_positions.
  update public.construction_projects cp
  set queue_position = (e ->> 'position')::integer
  from jsonb_array_elements(p_positions) e
  where cp.id = (e ->> 'projectId')::uuid;

  return query select v_non_terminal_count;
end;
$$;

revoke all on function public.reorder_construction_projects (uuid, jsonb)
from
  public;

grant
execute on function public.reorder_construction_projects (uuid, jsonb) to authenticated;
