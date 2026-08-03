-- Migration: add_turn_jobs_queue
-- #1277 (Phase 4 of the database scaling roadmap): durable turn job queue and
-- claim model. This is the coordination substrate an async turn worker sits on;
-- it does not yet change how turns are executed.
--
-- Design (see the ADR appended to
-- docs/superpowers/specs/2026-07-17-database-scaling-roadmap-design.md):
-- an in-database queue table plus SECURITY DEFINER claim RPCs, deliberately
-- worker-agnostic so either a pg_cron -> pg_net Edge worker or an external
-- polling worker can consume it without schema change.
--
-- Coordination contract:
-- - One active (pending/claimed) job per world, enforced by a partial unique
--   index; enqueue additionally refuses while a turn_transitions row for the
--   world is still 'running', reusing the existing FOR UPDATE world lock.
-- - Exclusive claim via FOR UPDATE SKIP LOCKED: two concurrent claimers can
--   never take the same job.
-- - Crash recovery via heartbeat_at: a claimed job whose heartbeat has gone
--   stale is re-claimable. Re-claiming rotates claimed_by, which fences the
--   crashed worker out of completing/failing the job afterwards.
-- - Completion is idempotent: completing an already-completed job is a no-op
--   returning false rather than an error or a second terminal write.
--
-- RLS: the queue is system/worker-only. No write policies and no table grants
-- to authenticated; rows are written exclusively by the RPCs below. SELECT is
-- limited to super admins and world admins so the admin UI can poll job state.
-- ---------------------------------------------------------------------------
create table public.turn_jobs (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  from_turn_number integer not null,
  turn_transition_id uuid references public.turn_transitions (id) on delete set null,
  status text not null default 'pending' check (
    status in ('pending', 'claimed', 'completed', 'failed')
  ),
  attempts integer not null default 0,
  max_attempts integer not null default 3 check (max_attempts > 0),
  claimed_by text,
  claimed_at timestamptz,
  heartbeat_at timestamptz,
  finished_at timestamptz,
  last_error text,
  enqueued_by_user_id uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One active turn job per world.
create unique index turn_jobs_one_active_per_world_idx on public.turn_jobs (world_id)
where
  status in ('pending', 'claimed');

-- Claim scan: pending jobs and stale claimed jobs, oldest first.
create index turn_jobs_claimable_idx on public.turn_jobs (status, created_at);

create index turn_jobs_world_id_created_at_idx on public.turn_jobs (world_id, created_at desc);

create trigger turn_jobs_set_updated_at before
update on public.turn_jobs for each row
execute function public.set_updated_at ();

alter table public.turn_jobs enable row level security;

-- Client roles get read access only; every write goes through the RPCs below.
revoke all on table public.turn_jobs
from
  anon,
  authenticated;

grant
select
  on table public.turn_jobs to authenticated;

create policy "turn_jobs_select_admin" on public.turn_jobs for
select
  to authenticated using (
    public.is_super_admin ()
    or public.is_world_admin (world_id)
  );

-- ---------------------------------------------------------------------------
-- enqueue_turn_job
-- Called by an admin (or the end-turn edge function on their behalf) to queue
-- a turn. Idempotent: if an active job already exists for the world its id is
-- returned instead of raising.
-- ---------------------------------------------------------------------------
create or replace function public.enqueue_turn_job (p_world_id uuid, p_expected_turn_number integer) returns uuid language plpgsql security definer
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
    raise exception 'world % not found', p_world_id using errcode = 'P0001';
  end if;

  if v_world_status = 'archived' then
    raise exception 'world is archived and cannot be advanced' using errcode = 'P0001';
  end if;

  if v_world_turn is null or v_world_turn <> p_expected_turn_number then
    raise exception 'stale expected turn number' using errcode = 'P0001';
  end if;

  -- Single active turn per world: refuse while a transition is still running.
  if exists (
    select
      1
    from
      public.turn_transitions tt
    where
      tt.world_id = p_world_id
      and tt.status = 'running'
  ) then
    raise exception 'world % already has a running turn transition', p_world_id
      using errcode = 'P0001';
  end if;

  insert into
    public.turn_jobs (world_id, from_turn_number, enqueued_by_user_id)
  values
    (p_world_id, p_expected_turn_number, auth.uid ())
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

-- ---------------------------------------------------------------------------
-- claim_turn_job
-- Worker entry point. Takes the oldest claimable job -- pending, or claimed
-- with a heartbeat older than p_stale_after -- and marks it claimed by the
-- calling worker. Returns null when there is nothing to do.
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
    'attempts', v_job.attempts,
    'maxAttempts', v_job.max_attempts,
    'claimedBy', v_job.claimed_by,
    'claimedAt', v_job.claimed_at
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- heartbeat_turn_job
-- Keeps a claim alive. Returns false once the claim has been lost (job
-- re-claimed by another worker, or already terminal) so the worker can abort.
-- ---------------------------------------------------------------------------
create or replace function public.heartbeat_turn_job (
  p_job_id uuid,
  p_worker_id text,
  p_transition_id uuid default null
) returns boolean language plpgsql security definer
set
  search_path = '' as $$
declare
  v_updated integer;
begin
  if p_job_id is null or p_worker_id is null then
    raise exception 'p_job_id and p_worker_id must not be null' using errcode = 'P0001';
  end if;

  update public.turn_jobs
  set
    heartbeat_at = now(),
    turn_transition_id = coalesce(p_transition_id, public.turn_jobs.turn_transition_id)
  where
    public.turn_jobs.id = p_job_id
    and public.turn_jobs.status = 'claimed'
    and public.turn_jobs.claimed_by = p_worker_id;

  get diagnostics v_updated = row_count;

  return v_updated = 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- complete_turn_job
-- Idempotent terminal write: only the current claimant can complete the job,
-- and completing an already-completed job returns false without re-writing.
-- ---------------------------------------------------------------------------
create or replace function public.complete_turn_job (p_job_id uuid, p_worker_id text) returns boolean language plpgsql security definer
set
  search_path = '' as $$
declare
  v_updated integer;
begin
  if p_job_id is null or p_worker_id is null then
    raise exception 'p_job_id and p_worker_id must not be null' using errcode = 'P0001';
  end if;

  update public.turn_jobs
  set
    status = 'completed',
    finished_at = now(),
    last_error = null
  where
    public.turn_jobs.id = p_job_id
    and public.turn_jobs.status = 'claimed'
    and public.turn_jobs.claimed_by = p_worker_id;

  get diagnostics v_updated = row_count;

  return v_updated = 1;
end;
$$;

-- ---------------------------------------------------------------------------
-- fail_turn_job
-- Releases a claim after an error. Below max_attempts the job returns to
-- 'pending' for retry; at max_attempts it is retired as 'failed'.
-- Returns the resulting status, or null when the claim was already lost.
-- ---------------------------------------------------------------------------
create or replace function public.fail_turn_job (
  p_job_id uuid,
  p_worker_id text,
  p_error text default null
) returns text language plpgsql security definer
set
  search_path = '' as $$
declare
  v_job public.turn_jobs%rowtype;
  v_status text;
begin
  if p_job_id is null or p_worker_id is null then
    raise exception 'p_job_id and p_worker_id must not be null' using errcode = 'P0001';
  end if;

  select
    tj.* into v_job
  from
    public.turn_jobs tj
  where
    tj.id = p_job_id
  for update;

  if not found
    or v_job.status <> 'claimed'
    or v_job.claimed_by is distinct from p_worker_id then
    return null;
  end if;

  v_status := case
    when v_job.attempts >= v_job.max_attempts then 'failed'
    else 'pending'
  end;

  update public.turn_jobs
  set
    status = v_status,
    last_error = p_error,
    claimed_by = null,
    claimed_at = null,
    heartbeat_at = null,
    finished_at = case
      when v_status = 'failed' then now()
      else null
    end
  where
    public.turn_jobs.id = v_job.id;

  return v_status;
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants: enqueue is an admin action (authorized inside the function); the
-- claim protocol is worker-only.
-- ---------------------------------------------------------------------------
revoke all on function public.enqueue_turn_job (uuid, integer)
from
  public,
  anon;

-- Not granted to service_role: authorization is via is_super_admin() /
-- is_world_admin(), which need an auth.uid() the service-role client lacks.
grant
execute on function public.enqueue_turn_job (uuid, integer) to authenticated;

revoke all on function public.claim_turn_job (text, interval)
from
  public,
  anon,
  authenticated;

grant
execute on function public.claim_turn_job (text, interval) to service_role;

revoke all on function public.heartbeat_turn_job (uuid, text, uuid)
from
  public,
  anon,
  authenticated;

grant
execute on function public.heartbeat_turn_job (uuid, text, uuid) to service_role;

revoke all on function public.complete_turn_job (uuid, text)
from
  public,
  anon,
  authenticated;

grant
execute on function public.complete_turn_job (uuid, text) to service_role;

revoke all on function public.fail_turn_job (uuid, text, text)
from
  public,
  anon,
  authenticated;

grant
execute on function public.fail_turn_job (uuid, text, text) to service_role;
