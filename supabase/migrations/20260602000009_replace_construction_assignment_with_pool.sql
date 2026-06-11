-- Migration: replace_construction_assignment_with_pool
-- Per Epic 6 plan §3.2 and decision §11.2: replace per-project construction
-- worker assignment with a settlement-wide pool model. The simulation allocates
-- pool workers across the project queue by queue_position each transition.
--
-- Changes:
-- 1. citizen_assignments.construction_project_id is already nullable — no DDL needed.
-- 2. Relax citizen_assignments_target_shape_check so assignment_type = 'construction_project'
--    may have NULL construction_project_id (pool member not yet allocated to a project).
-- 3. Add set_bulk_construction_pool(settlement_id, target_count) RPC.
-- 4. One-time data migration: nullify construction_project_id on existing rows.
--
-- NOTE: set_bulk_construction_assignment is NOT dropped here; it remains live for
-- the transition period while the UI migrates (#F45a will drop it).
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- 2. Relax citizen_assignments_target_shape_check
--    Only the 'construction_project' branch changes: construction_project_id
--    may now be NULL (pool member) or non-NULL (specific project).
-- ---------------------------------------------------------------------------
alter table public.citizen_assignments
drop constraint citizen_assignments_target_shape_check;

alter table public.citizen_assignments
add constraint citizen_assignments_target_shape_check check (
  (
    assignment_type = 'standard_job'
    and job_id is not null
    and construction_project_id is null
    and deposit_instance_id is null
    and managed_population_instance_id is null
    and trade_route_id is null
  )
  or (
    assignment_type = 'construction_project'
    and deposit_instance_id is null
    and managed_population_instance_id is null
    and trade_route_id is null
    -- construction_project_id may be null (pool member) or non-null (specific project)
  )
  or (
    assignment_type = 'deposit'
    and deposit_instance_id is not null
    and construction_project_id is null
    and managed_population_instance_id is null
    and trade_route_id is null
  )
  or (
    assignment_type in ('husbandry', 'culling')
    and managed_population_instance_id is not null
    and construction_project_id is null
    and deposit_instance_id is null
    and trade_route_id is null
  )
  or (
    assignment_type = 'trade_route'
    and trade_route_id is not null
    and construction_project_id is null
    and deposit_instance_id is null
    and managed_population_instance_id is null
  )
);

-- ---------------------------------------------------------------------------
-- 3. set_bulk_construction_pool
--    Manages the total headcount of construction workers for a settlement.
--    Workers are assigned with construction_project_id = NULL; the simulation
--    allocates them to specific projects by queue_position each turn.
-- ---------------------------------------------------------------------------
create or replace function public.set_bulk_construction_pool (p_settlement_id uuid, p_target_count integer) returns table (
  before integer,
  after integer,
  added_citizen_ids uuid[],
  removed_citizen_ids uuid[]
) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id      uuid;
  v_turn_number   integer;
  v_current_count integer;
  v_delta         integer;
  v_added_ids     uuid[] := array[]::uuid[];
  v_removed_ids   uuid[] := array[]::uuid[];
begin
  -- Null guard
  if p_settlement_id is null
     or p_target_count is null
  then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Input validation
  if p_target_count < 0 then
    raise exception 'target count must not be negative'
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

  -- Current world turn number (used when inserting new assignments)
  select w.current_turn_number
    into v_turn_number
    from public.worlds w
   where w.id = v_world_id;

  -- Current construction pool count for this settlement
  -- (all assignment_type='construction_project' rows, regardless of project linkage)
  select count (*)::integer
    into v_current_count
    from public.citizen_assignments ca
    join public.citizens c on c.id = ca.citizen_id
   where ca.assignment_type = 'construction_project'
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
    -- Raise: add unassigned alive NPCs (reject if insufficient)
    if (
      select count (*)
        from public.citizens c
        left join public.citizen_assignments ca on ca.citizen_id = c.id
       where c.settlement_id = p_settlement_id
         and c.status        = 'alive'
         and c.citizen_type  = 'npc'
         and ca.citizen_id   is null
    ) < v_delta then
      raise exception 'insufficient unassigned NPCs available'
        using errcode = 'P0001';
    end if;

    -- Deterministic-random within the transaction: seed with fractional epoch
    perform setseed (
      extract (epoch from now ())::numeric
      - floor (extract (epoch from now ())::numeric)
    );

    with selected_npcs as (
      select c.id
        from public.citizens c
        left join public.citizen_assignments ca on ca.citizen_id = c.id
       where c.settlement_id = p_settlement_id
         and c.status        = 'alive'
         and c.citizen_type  = 'npc'
         and ca.citizen_id   is null
       order by random ()
       limit v_delta
    ),
    inserted as (
      insert into public.citizen_assignments (
        citizen_id,
        assignment_type,
        construction_project_id,
        assigned_on_turn_number
      )
      select sn.id, 'construction_project', null, v_turn_number
        from selected_npcs sn
      returning citizen_id
    )
    select array_agg (citizen_id order by citizen_id)
      into v_added_ids
      from inserted;

    v_removed_ids := array[]::uuid[];

  else
    -- Lower: remove pool members in deterministic-random order
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
         where ca.assignment_type = 'construction_project'
           and c.settlement_id    = p_settlement_id
         order by random () asc
         limit (v_current_count - p_target_count)
      ) t;

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

revoke all on function public.set_bulk_construction_pool (uuid, integer)
from
  public;

grant
execute on function public.set_bulk_construction_pool (uuid, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. One-time data migration: move existing per-project construction
--    assignments to pool rows (NULL construction_project_id).
--    The simulation engine will re-allocate them by project queue each turn.
-- ---------------------------------------------------------------------------
update public.citizen_assignments
set
  construction_project_id = null
where
  assignment_type = 'construction_project'
  and construction_project_id is not null;
