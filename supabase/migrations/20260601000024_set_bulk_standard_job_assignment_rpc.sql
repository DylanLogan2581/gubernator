-- Migration: set_bulk_standard_job_assignment_rpc
-- Adds two functions for the bulk standard-job assignment surface (Epic 5):
--
--   get_settlement_standard_job_counts(p_settlement_id)
--     STABLE SECURITY DEFINER helper for the settlement job-count query.
--     Returns every non-trashed standard job_definition in the settlement's
--     world together with the current assigned-citizen count for that
--     settlement and the settlement_job_capacity helper value.
--
--   set_bulk_standard_job_assignment(p_settlement_id, p_job_id, p_target_count)
--     SECURITY DEFINER RPC that sets the number of citizens assigned to a
--     standard job in a settlement to exactly p_target_count.
--     NOTE: migration 20260601000027 drops the original 4-argument form
--     (which accepted p_removal_strategy) and replaces it with this
--     3-argument version; see that migration for the current function body.
--
-- Authorised callers for the mutation: admin (super admin / world admin) OR
--   current_user_manages_settlement(p_settlement_id).
--
-- Error contract (mutation):
--   P0002 (no_data_found)          – null param, settlement not found, job
--                                    not found or not in the same world
--   42501 (insufficient_privilege) – caller lacks authority
--   P0001 (raise_exception)        – negative target, trashed job,
--                                    non-standard job, target exceeds capacity,
--                                    insufficient unassigned NPCs when raising
--
-- Raise behaviour: picks unassigned alive NPCs using deterministic-random
--   order (setseed(frac(epoch)) + order by random()); rejects if not enough
--   NPCs are available.
-- Lower behaviour: removes assignees in the same deterministic-random order.
--   No PC sort tier is needed; a DB trigger (migration 20260601000027) blocks
--   PC assignments on every path.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- get_settlement_standard_job_counts
-- ---------------------------------------------------------------------------
create or replace function public.get_settlement_standard_job_counts (p_settlement_id uuid) returns table (
  job_id uuid,
  job_name text,
  job_slug text,
  world_id uuid,
  current_count integer,
  capacity integer
) language sql stable security definer
set
  search_path = '' as $$
  select
    j.id    as job_id,
    j.name  as job_name,
    j.slug  as job_slug,
    n.world_id,
    coalesce(
      (
        select count (*)::integer
        from   public.citizen_assignments ca
        join   public.citizens c on c.id = ca.citizen_id
        where  ca.job_id          = j.id
          and  ca.assignment_type = 'standard_job'
          and  c.settlement_id    = p_settlement_id
      ),
      0
    ) as current_count,
    public.settlement_job_capacity (p_settlement_id, j.id) as capacity
  from   public.job_definitions j
  join   public.settlements s on s.id  = p_settlement_id
  join   public.nations     n on n.id  = s.nation_id
  where  j.world_id   = n.world_id
    and  j.job_type   = 'standard'
    and  j.is_trashed = false
  order by j.name, j.id
$$;

revoke all on function public.get_settlement_standard_job_counts (uuid)
from
  public;

grant
execute on function public.get_settlement_standard_job_counts (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- set_bulk_standard_job_assignment
-- ---------------------------------------------------------------------------
create or replace function public.set_bulk_standard_job_assignment (
  p_settlement_id uuid,
  p_job_id uuid,
  p_target_count integer,
  p_removal_strategy text
) returns table (
  before integer,
  after integer,
  added_citizen_ids uuid[],
  removed_citizen_ids uuid[]
) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id       uuid;
  v_turn_number    integer;
  v_job_type       text;
  v_job_is_trashed boolean;
  v_capacity       integer;
  v_current_count  integer;
  v_delta          integer;
  v_added_ids      uuid[] := array[]::uuid[];
  v_removed_ids    uuid[] := array[]::uuid[];
begin
  -- Null guard
  if p_settlement_id is null
     or p_job_id is null
     or p_target_count is null
     or p_removal_strategy is null
  then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Input validation
  if p_target_count < 0 then
    raise exception 'target count must not be negative'
      using errcode = 'P0001';
  end if;

  if p_removal_strategy not in ('npc_first', 'random') then
    raise exception 'removal_strategy must be npc_first or random'
      using errcode = 'P0001';
  end if;

  -- Resolve settlement → world
  select n.world_id
    into v_world_id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
   where s.id = p_settlement_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Authorization
  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_world_id)
    or public.current_user_manages_settlement (p_settlement_id)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Load job (must belong to the same world)
  select j.job_type, j.is_trashed
    into v_job_type, v_job_is_trashed
    from public.job_definitions j
   where j.id       = p_job_id
     and j.world_id = v_world_id;

  if v_job_type is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_job_is_trashed then
    raise exception 'job is trashed' using errcode = 'P0001';
  end if;

  if v_job_type <> 'standard' then
    raise exception 'job type must be standard' using errcode = 'P0001';
  end if;

  -- Capacity check
  v_capacity := public.settlement_job_capacity (p_settlement_id, p_job_id);

  if p_target_count > v_capacity then
    raise exception 'target count exceeds settlement job capacity'
      using errcode = 'P0001';
  end if;

  -- Current world turn number (used when inserting new assignments)
  select w.current_turn_number
    into v_turn_number
    from public.worlds w
   where w.id = v_world_id;

  -- Current count of citizens assigned to this job in this settlement
  select count (*)::integer
    into v_current_count
    from public.citizen_assignments ca
    join public.citizens c on c.id = ca.citizen_id
   where ca.assignment_type = 'standard_job'
     and ca.job_id          = p_job_id
     and c.settlement_id    = p_settlement_id;

  -- No-op
  if v_current_count = p_target_count then
    before              := v_current_count;
    after               := v_current_count;
    added_citizen_ids   := array[]::uuid[];
    removed_citizen_ids := array[]::uuid[];
    return next;
    return;
  end if;

  v_delta := p_target_count - v_current_count;

  if v_delta > 0 then
    -- Raise: add unassigned NPCs (NPCs only per spec §5; reject if insufficient)
    if (
      select count (*)
        from public.citizens c
        left join public.citizen_assignments ca on ca.citizen_id = c.id
       where c.settlement_id  = p_settlement_id
         and c.status         = 'alive'
         and c.citizen_type   = 'npc'
         and ca.citizen_id    is null
    ) < v_delta then
      raise exception 'insufficient unassigned NPCs available'
        using errcode = 'P0001';
    end if;

    with selected_npcs as (
      select c.id
        from public.citizens c
        left join public.citizen_assignments ca on ca.citizen_id = c.id
       where c.settlement_id = p_settlement_id
         and c.status        = 'alive'
         and c.citizen_type  = 'npc'
         and ca.citizen_id   is null
       order by c.id
       limit v_delta
    ),
    inserted as (
      insert into public.citizen_assignments (
        citizen_id,
        assignment_type,
        job_id,
        assigned_on_turn_number
      )
      select sn.id, 'standard_job', p_job_id, v_turn_number
        from selected_npcs sn
      returning citizen_id
    )
    select array_agg (citizen_id order by citizen_id)
      into v_added_ids
      from inserted;

    v_removed_ids := array[]::uuid[];

  else
    -- Lower: remove citizens
    if p_removal_strategy = 'random' then
      -- Deterministic-random within the transaction: seed with fractional epoch
      perform setseed (
        extract (epoch from now ())::numeric
        - floor (extract (epoch from now ())::numeric)
      );

      select array_agg (t.citizen_id)
        into v_removed_ids
        from (
          select ca.citizen_id
            from public.citizen_assignments ca
            join public.citizens c on c.id = ca.citizen_id
           where ca.assignment_type = 'standard_job'
             and ca.job_id          = p_job_id
             and c.settlement_id    = p_settlement_id
           order by (c.citizen_type = 'player_character')::int asc,
                    random () asc
           limit (v_current_count - p_target_count)
        ) t;

    else
      -- npc_first: NPCs before PCs; stable citizen_id tiebreak within each tier
      select array_agg (t.citizen_id)
        into v_removed_ids
        from (
          select ca.citizen_id
            from public.citizen_assignments ca
            join public.citizens c on c.id = ca.citizen_id
           where ca.assignment_type = 'standard_job'
             and ca.job_id          = p_job_id
             and c.settlement_id    = p_settlement_id
           order by (c.citizen_type = 'player_character')::int asc,
                    ca.citizen_id asc
           limit (v_current_count - p_target_count)
        ) t;
    end if;

    delete from public.citizen_assignments ca
     where ca.citizen_id = any (v_removed_ids);

    v_added_ids := array[]::uuid[];
  end if;

  before              := v_current_count;
  after               := p_target_count;
  added_citizen_ids   := coalesce (v_added_ids,   array[]::uuid[]);
  removed_citizen_ids := coalesce (v_removed_ids, array[]::uuid[]);
  return next;
end;
$$;

revoke all on function public.set_bulk_standard_job_assignment (uuid, uuid, integer, text)
from
  public;

grant
execute on function public.set_bulk_standard_job_assignment (uuid, uuid, integer, text) to authenticated;
