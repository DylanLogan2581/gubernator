-- Migration: set_bulk_construction_assignment_rpc
-- Adds two functions for the bulk construction-project assignment surface (Epic 5):
--
--   get_settlement_construction_project_counts(p_settlement_id)
--     STABLE SECURITY DEFINER helper for the settlement construction-project
--     count query. Returns every non-terminal construction_project in the
--     settlement together with the current assigned-citizen count.
--
--   set_bulk_construction_assignment(p_construction_project_id, p_target_count)
--     SECURITY DEFINER RPC that sets the number of citizens assigned to a
--     construction project to exactly p_target_count.
--     NOTE: migration 20260601000027 drops the original 3-argument form
--     (which accepted p_removal_strategy) and replaces it with this
--     2-argument version; see that migration for the current function body.
--
-- Authorised callers for the mutation: super admin, world admin, OR
--   current_user_manages_settlement(parent_settlement_id).
--
-- Error contract (mutation):
--   P0002 (no_data_found)          – null param, project not found
--   42501 (insufficient_privilege) – caller lacks authority
--   P0001 (raise_exception)        – negative target, terminal project
--                                    (complete/cancelled), insufficient
--                                    unassigned NPCs when raising
--
-- Raise behaviour: picks unassigned alive NPCs using deterministic-random
--   order (setseed(frac(epoch)) + order by random()); rejects if not enough
--   NPCs are available.
-- Lower behaviour: removes assignees in the same deterministic-random order.
--   No PC sort tier is needed; a DB trigger (migration 20260601000027) blocks
--   PC assignments on every path.
-- No settlement-wide cap applies to construction jobs (spec §7); per-project
--   ceiling is operational, not enforced at the DB layer.
-- ---------------------------------------------------------------------------
-- get_settlement_construction_project_counts
-- ---------------------------------------------------------------------------
create or replace function public.get_settlement_construction_project_counts (p_settlement_id uuid) returns table (
  construction_project_id uuid,
  status text,
  queue_position integer,
  current_count integer,
  building_blueprint_id uuid,
  target_tier_id uuid
) language sql stable security definer
set
  search_path = '' as $$
  select
    cp.id                     as construction_project_id,
    cp.status,
    cp.queue_position,
    coalesce(
      (
        select count(*)::integer
        from   public.citizen_assignments ca
        where  ca.assignment_type          = 'construction_project'
          and  ca.construction_project_id  = cp.id
      ),
      0
    )                         as current_count,
    cp.building_blueprint_id,
    cp.target_tier_id
  from   public.construction_projects cp
  where  cp.settlement_id = p_settlement_id
    and  cp.status not in ('complete', 'cancelled')
  order by cp.queue_position, cp.id
$$;

revoke all on function public.get_settlement_construction_project_counts (uuid)
from
  public;

grant
execute on function public.get_settlement_construction_project_counts (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- set_bulk_construction_assignment
-- ---------------------------------------------------------------------------
create or replace function public.set_bulk_construction_assignment (
  p_construction_project_id uuid,
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
  v_settlement_id  uuid;
  v_project_status text;
  v_world_id       uuid;
  v_turn_number    integer;
  v_current_count  integer;
  v_delta          integer;
  v_added_ids      uuid[] := array[]::uuid[];
  v_removed_ids    uuid[] := array[]::uuid[];
begin
  -- Null guard
  if p_construction_project_id is null
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

  -- Load project (get settlement_id and status; P0002 if not found)
  select cp.settlement_id, cp.status
    into v_settlement_id, v_project_status
    from public.construction_projects cp
   where cp.id = p_construction_project_id;

  if v_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  -- Resolve settlement → world
  select n.world_id
    into v_world_id
    from public.settlements s
    join public.nations n on n.id = s.nation_id
   where s.id = v_settlement_id;

  -- Authorization
  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_world_id)
    or public.current_user_manages_settlement (v_settlement_id)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  -- Reject terminal projects
  if v_project_status in ('complete', 'cancelled') then
    raise exception 'construction project is in a terminal status (%)', v_project_status
      using errcode = 'P0001';
  end if;

  -- Current world turn number (used when inserting new assignments)
  select w.current_turn_number
    into v_turn_number
    from public.worlds w
   where w.id = v_world_id;

  -- Current count of citizens assigned to this construction project
  select count(*)::integer
    into v_current_count
    from public.citizen_assignments ca
   where ca.assignment_type         = 'construction_project'
     and ca.construction_project_id = p_construction_project_id;

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
    -- Raise: add unassigned NPCs (reject if insufficient)
    if (
      select count(*)
        from public.citizens c
        left join public.citizen_assignments ca on ca.citizen_id = c.id
       where c.settlement_id = v_settlement_id
         and c.status        = 'alive'
         and c.citizen_type  = 'npc'
         and ca.citizen_id   is null
    ) < v_delta then
      raise exception 'insufficient unassigned NPCs available'
        using errcode = 'P0001';
    end if;

    with selected_npcs as (
      select c.id
        from public.citizens c
        left join public.citizen_assignments ca on ca.citizen_id = c.id
       where c.settlement_id = v_settlement_id
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
        construction_project_id,
        assigned_on_turn_number
      )
      select sn.id, 'construction_project', p_construction_project_id, v_turn_number
        from selected_npcs sn
      returning citizen_id
    )
    select array_agg(citizen_id order by citizen_id)
      into v_added_ids
      from inserted;

    v_removed_ids := array[]::uuid[];

  else
    -- Lower: remove citizens
    if p_removal_strategy = 'random' then
      -- Deterministic-random within the transaction: seed with fractional epoch
      perform setseed(
        extract(epoch from now())::numeric
        - floor(extract(epoch from now())::numeric)
      );

      select array_agg(t.citizen_id)
        into v_removed_ids
        from (
          select ca.citizen_id
            from public.citizen_assignments ca
            join public.citizens c on c.id = ca.citizen_id
           where ca.assignment_type         = 'construction_project'
             and ca.construction_project_id = p_construction_project_id
           order by (c.citizen_type = 'player_character')::int asc,
                    random() asc
           limit (v_current_count - p_target_count)
        ) t;

    else
      -- npc_first: NPCs before PCs; stable citizen_id tiebreak within each tier
      select array_agg(t.citizen_id)
        into v_removed_ids
        from (
          select ca.citizen_id
            from public.citizen_assignments ca
            join public.citizens c on c.id = ca.citizen_id
           where ca.assignment_type         = 'construction_project'
             and ca.construction_project_id = p_construction_project_id
           order by (c.citizen_type = 'player_character')::int asc,
                    ca.citizen_id asc
           limit (v_current_count - p_target_count)
        ) t;
    end if;

    delete from public.citizen_assignments ca
     where ca.citizen_id = any(v_removed_ids);

    v_added_ids := array[]::uuid[];
  end if;

  before              := v_current_count;
  after               := p_target_count;
  added_citizen_ids   := coalesce(v_added_ids,   array[]::uuid[]);
  removed_citizen_ids := coalesce(v_removed_ids, array[]::uuid[]);
  return next;
end;
$$;

revoke all on function public.set_bulk_construction_assignment (uuid, integer, text)
from
  public;

grant
execute on function public.set_bulk_construction_assignment (uuid, integer, text) to authenticated;
