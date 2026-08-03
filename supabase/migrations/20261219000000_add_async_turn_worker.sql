-- Migration: add_async_turn_worker
-- #1278 (Phase 4 of the database scaling roadmap): run the end-turn pipeline in
-- a background worker instead of inline on the synchronous request.
--
-- The queue substrate itself landed in 20261218000000_add_turn_jobs_queue.sql.
-- This migration adds only what the worker host needs on top of it:
--
--   1. turn_transitions.progress_stage -- coarse progress the worker stamps as
--      it moves through load -> simulate -> forecast -> persist, so the UI can
--      say more than "running" while a long turn is in flight.
--   2. enqueue_turn_job gains p_turn_transition_id. The request now calls
--      start_turn_transition FIRST (so it can hand the client a transition id
--      immediately) and enqueues second; without this parameter the queue's
--      "refuse while a transition is running" guard would reject the very
--      transition being enqueued. The guard still rejects every OTHER running
--      transition, so single-active-turn-per-world is unchanged.
--   3. claim_turn_job returns enqueuedByUserId. On a retry the worker has to
--      open a FRESH transition (the previous one is already terminal) and
--      start_turn_transition records an initiating user; that user is the
--      admin who enqueued the job, not the worker.
--   4. A service-role branch in settlement_effective_storage_cap so the worker
--      can load simulation state privileged.
--
-- RLS: no new tables. progress_stage is written by the worker with the service
-- role and read through the existing turn_transitions select policy
-- (has_world_access), which is the same visibility the status column already
-- has. No policy change required.
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- 1. Worker progress on the transition row
-- ---------------------------------------------------------------------------
alter table public.turn_transitions
add column progress_stage text check (
  progress_stage is null
  or progress_stage in ('queued', 'loading', 'simulating', 'persisting')
);

comment on column public.turn_transitions.progress_stage is 'Coarse progress of the background turn worker while status = ''running''. Null once the transition reaches a terminal status. Written by the worker (service role); readable through the existing world-access select policy.';

-- ---------------------------------------------------------------------------
-- 2. enqueue_turn_job: accept the transition the caller just started
-- ---------------------------------------------------------------------------
-- Signature change, so drop rather than replace: a defaulted third parameter
-- added via create-or-replace would leave the 2-arg overload behind and make
-- two-argument calls ambiguous.
drop function if exists public.enqueue_turn_job (uuid, integer);

create or replace function public.enqueue_turn_job (
  p_world_id uuid,
  p_expected_turn_number integer,
  p_turn_transition_id uuid default null
) returns uuid language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_status text;
  v_world_turn integer;
  v_job_id uuid;
begin
  if p_world_id is null then
    raise exception 'p_world_id must not be null' using errcode = 'P0001';
  end if;

  if p_expected_turn_number is null then
    raise exception 'p_expected_turn_number must not be null' using errcode = 'P0001';
  end if;

  if not (public.is_super_admin () or public.is_world_admin (p_world_id)) then
    raise exception 'insufficient privilege' using errcode = 'insufficient_privilege';
  end if;

  -- Lock the world row so concurrent enqueues queue behind this transaction.
  select
    w.status,
    w.current_turn_number into v_world_status,
    v_world_turn
  from
    public.worlds w
  where
    w.id = p_world_id
  for update;

  if v_world_status is null then
    raise exception 'world % not found', p_world_id
      using errcode = 'P0001', hint = 'world_not_found';
  end if;

  if v_world_status = 'archived' then
    raise exception 'world is archived and cannot be advanced'
      using errcode = 'P0001', hint = 'world_archived';
  end if;

  if v_world_turn is null or v_world_turn <> p_expected_turn_number then
    raise exception 'stale expected turn number'
      using errcode = 'P0001', hint = 'stale_expected_turn';
  end if;

  -- Single active turn per world: refuse while any OTHER transition for the
  -- world is still running. The transition the caller just opened for this
  -- very job (p_turn_transition_id) is exempt.
  if exists (
    select
      1
    from
      public.turn_transitions tt
    where
      tt.world_id = p_world_id
      and tt.status = 'running'
      and (
        p_turn_transition_id is null
        or tt.id <> p_turn_transition_id
      )
  ) then
    raise exception 'world % already has a running turn transition', p_world_id
      using errcode = 'P0001', hint = 'running_transition';
  end if;

  insert into
    public.turn_jobs (
      world_id,
      from_turn_number,
      turn_transition_id,
      enqueued_by_user_id
    )
  values
    (
      p_world_id,
      p_expected_turn_number,
      p_turn_transition_id,
      auth.uid ()
    )
  on conflict do nothing
  returning
    id into v_job_id;

  if v_job_id is null then
    select
      tj.id into v_job_id
    from
      public.turn_jobs tj
    where
      tj.world_id = p_world_id
      and tj.status in ('pending', 'claimed')
    order by
      tj.created_at
    limit
      1;
  end if;

  return v_job_id;
end;
$$;

revoke all on function public.enqueue_turn_job (uuid, integer, uuid)
from
  public,
  anon;

-- Not granted to service_role: authorization is via is_super_admin() /
-- is_world_admin(), which need an auth.uid() the service-role client lacks.
grant
execute on function public.enqueue_turn_job (uuid, integer, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. claim_turn_job: hand the worker the enqueuing user
-- ---------------------------------------------------------------------------
create or replace function public.claim_turn_job (
  p_worker_id text,
  p_stale_after interval default interval '2 minutes'
) returns jsonb language plpgsql security definer
set
  search_path = '' as $$
declare
  v_job public.turn_jobs%rowtype;
begin
  if p_worker_id is null or length(trim(p_worker_id)) = 0 then
    raise exception 'p_worker_id must not be empty' using errcode = 'P0001';
  end if;

  -- SKIP LOCKED gives exclusive claim: a concurrent claimer steps over any row
  -- this transaction has locked rather than blocking on it.
  select
    tj.* into v_job
  from
    public.turn_jobs tj
  where
    tj.status = 'pending'
    or (
      tj.status = 'claimed'
      and (
        tj.heartbeat_at is null
        or tj.heartbeat_at < now() - p_stale_after
      )
    )
  order by
    tj.created_at
  limit
    1
  for update
    skip locked;

  if not found then
    return null;
  end if;

  -- Exhausted retries: retire the job instead of handing it out again.
  if v_job.attempts >= v_job.max_attempts then
    update public.turn_jobs
    set
      status = 'failed',
      finished_at = now(),
      last_error = coalesce(v_job.last_error, 'max attempts exceeded')
    where
      public.turn_jobs.id = v_job.id;

    return null;
  end if;

  update public.turn_jobs
  set
    status = 'claimed',
    attempts = public.turn_jobs.attempts + 1,
    claimed_by = p_worker_id,
    claimed_at = now(),
    heartbeat_at = now()
  where
    public.turn_jobs.id = v_job.id
  returning
    * into v_job;

  return jsonb_build_object (
    'jobId', v_job.id,
    'worldId', v_job.world_id,
    'fromTurnNumber', v_job.from_turn_number,
    'turnTransitionId', v_job.turn_transition_id,
    'enqueuedByUserId', v_job.enqueued_by_user_id,
    'attempts', v_job.attempts,
    'maxAttempts', v_job.max_attempts,
    'claimedBy', v_job.claimed_by,
    'claimedAt', v_job.claimed_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Privileged state load: admit the service role
-- ---------------------------------------------------------------------------
-- settlement_stockpiles_view is a security_invoker view whose effective_cap
-- column calls this wrapper, so the wrapper decides whether the background
-- worker can read stockpiles at all. The guard exists to reject anon callers
-- and foreign-world users; the service role is not one of those -- it already
-- bypasses RLS on settlement_resource_stockpiles and could recompute the cap
-- from the base tables it can read anyway. Admitting it here is what lets the
-- worker load simulation state without borrowing an end user's JWT.
create or replace function public.settlement_effective_storage_cap (p_settlement_id uuid, p_resource_id uuid) returns numeric language plpgsql stable security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
begin
  if auth.role () = 'service_role' then
    return public.settlement_effective_storage_cap_internal (p_settlement_id, p_resource_id);
  end if;

  select n.world_id
  into   v_world_id
  from   public.settlements s
  join   public.nations     n on n.id = s.nation_id
  where  s.id = p_settlement_id;

  if not public.current_user_has_world_access (v_world_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return public.settlement_effective_storage_cap_internal (p_settlement_id, p_resource_id);
end;
$$;
