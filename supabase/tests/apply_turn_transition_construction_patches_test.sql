-- pgTAP tests for §C29: apply_turn_transition construction and building patches.
-- Run with: npx supabase test db
--
-- UUID prefix map (all a6-prefixed ranges, unique to this file):
--   a6100000 = users        a6200000 = worlds
--   a6300000 = nations      a6400000 = settlements
--   a6500000 = blueprints   a6600000 = blueprint tiers
--   a6700000 = projects     a6800000 = pre-existing buildings
begin;

select
  plan (16);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into
  auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_user_meta_data,
    created_at,
    updated_at
  )
values
  (
    'a6100000-0000-0000-0000-000000000001',
    'attcp-superadmin@example.com',
    'x',
    now(),
    '{"username":"attcp_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'a6100000-0000-0000-0000-000000000001';

-- Five worlds — one per scenario, all at turn 3:
--   World 1: single project advance
--   World 2: single project completion + building creation
--   World 3: building suspend
--   World 4: building auto-deconstruct
--   World 5: multi-project batch
insert into
  public.worlds (
    id,
    name,
    owner_id,
    current_turn_number,
    visibility,
    status
  )
values
  (
    'a6200000-0000-0000-0000-000000000001',
    'ATTCP Project Advance World',
    'a6100000-0000-0000-0000-000000000001',
    3,
    'private',
    'active'
  ),
  (
    'a6200000-0000-0000-0000-000000000002',
    'ATTCP Project Complete World',
    'a6100000-0000-0000-0000-000000000001',
    3,
    'private',
    'active'
  ),
  (
    'a6200000-0000-0000-0000-000000000003',
    'ATTCP Building Suspend World',
    'a6100000-0000-0000-0000-000000000001',
    3,
    'private',
    'active'
  ),
  (
    'a6200000-0000-0000-0000-000000000004',
    'ATTCP Building Autodeconstruct World',
    'a6100000-0000-0000-0000-000000000001',
    3,
    'private',
    'active'
  ),
  (
    'a6200000-0000-0000-0000-000000000005',
    'ATTCP Multi Batch World',
    'a6100000-0000-0000-0000-000000000001',
    3,
    'private',
    'active'
  );

-- One nation per world
insert into
  public.nations (id, world_id, name)
values
  (
    'a6300000-0000-0000-0000-000000000001',
    'a6200000-0000-0000-0000-000000000001',
    'ATTCP Nation 1'
  ),
  (
    'a6300000-0000-0000-0000-000000000002',
    'a6200000-0000-0000-0000-000000000002',
    'ATTCP Nation 2'
  ),
  (
    'a6300000-0000-0000-0000-000000000003',
    'a6200000-0000-0000-0000-000000000003',
    'ATTCP Nation 3'
  ),
  (
    'a6300000-0000-0000-0000-000000000004',
    'a6200000-0000-0000-0000-000000000004',
    'ATTCP Nation 4'
  ),
  (
    'a6300000-0000-0000-0000-000000000005',
    'a6200000-0000-0000-0000-000000000005',
    'ATTCP Nation 5'
  );

-- One settlement per world
insert into
  public.settlements (id, nation_id, name)
values
  (
    'a6400000-0000-0000-0000-000000000001',
    'a6300000-0000-0000-0000-000000000001',
    'ATTCP Settlement 1'
  ),
  (
    'a6400000-0000-0000-0000-000000000002',
    'a6300000-0000-0000-0000-000000000002',
    'ATTCP Settlement 2'
  ),
  (
    'a6400000-0000-0000-0000-000000000003',
    'a6300000-0000-0000-0000-000000000003',
    'ATTCP Settlement 3'
  ),
  (
    'a6400000-0000-0000-0000-000000000004',
    'a6300000-0000-0000-0000-000000000004',
    'ATTCP Settlement 4'
  ),
  (
    'a6400000-0000-0000-0000-000000000005',
    'a6300000-0000-0000-0000-000000000005',
    'ATTCP Settlement 5'
  );

-- One building blueprint per world (max_instances_per_settlement = NULL → no cap)
insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'a6500000-0000-0000-0000-000000000001',
    'a6200000-0000-0000-0000-000000000001',
    'ATTCP Granary 1',
    'attcp-granary-1'
  ),
  (
    'a6500000-0000-0000-0000-000000000002',
    'a6200000-0000-0000-0000-000000000002',
    'ATTCP Granary 2',
    'attcp-granary-2'
  ),
  (
    'a6500000-0000-0000-0000-000000000003',
    'a6200000-0000-0000-0000-000000000003',
    'ATTCP Granary 3',
    'attcp-granary-3'
  ),
  (
    'a6500000-0000-0000-0000-000000000004',
    'a6200000-0000-0000-0000-000000000004',
    'ATTCP Granary 4',
    'attcp-granary-4'
  ),
  (
    'a6500000-0000-0000-0000-000000000005',
    'a6200000-0000-0000-0000-000000000005',
    'ATTCP Granary 5',
    'attcp-granary-5'
  );

-- One tier per blueprint (tier 1, 10 worker-turns required)
insert into
  public.building_blueprint_tiers (
    id,
    building_blueprint_id,
    tier_number,
    worker_turns_required
  )
values
  (
    'a6600000-0000-0000-0000-000000000001',
    'a6500000-0000-0000-0000-000000000001',
    1,
    10
  ),
  (
    'a6600000-0000-0000-0000-000000000002',
    'a6500000-0000-0000-0000-000000000002',
    1,
    10
  ),
  (
    'a6600000-0000-0000-0000-000000000003',
    'a6500000-0000-0000-0000-000000000003',
    1,
    10
  ),
  (
    'a6600000-0000-0000-0000-000000000004',
    'a6500000-0000-0000-0000-000000000004',
    1,
    10
  ),
  (
    'a6600000-0000-0000-0000-000000000005',
    'a6500000-0000-0000-0000-000000000005',
    1,
    10
  );

-- Construction projects:
--   P1: World 1, status=queued  (will be advanced to in_progress)
--   P2: World 2, status=in_progress  (will be completed, creating a building)
--   P5a: World 5 position 1 (multi-batch advance A)
--   P5b: World 5 position 2 (multi-batch advance B)
insert into
  public.construction_projects (
    id,
    settlement_id,
    building_blueprint_id,
    target_tier_id,
    status,
    queue_position,
    progress_worker_turns
  )
values
  (
    'a6700000-0000-0000-0000-000000000001',
    'a6400000-0000-0000-0000-000000000001',
    'a6500000-0000-0000-0000-000000000001',
    'a6600000-0000-0000-0000-000000000001',
    'queued',
    1,
    0
  ),
  (
    'a6700000-0000-0000-0000-000000000002',
    'a6400000-0000-0000-0000-000000000002',
    'a6500000-0000-0000-0000-000000000002',
    'a6600000-0000-0000-0000-000000000002',
    'in_progress',
    1,
    8
  ),
  (
    'a6700000-0000-0000-0000-000000000005',
    'a6400000-0000-0000-0000-000000000005',
    'a6500000-0000-0000-0000-000000000005',
    'a6600000-0000-0000-0000-000000000005',
    'queued',
    1,
    0
  ),
  (
    'a6700000-0000-0000-0000-000000000006',
    'a6400000-0000-0000-0000-000000000005',
    'a6500000-0000-0000-0000-000000000005',
    'a6600000-0000-0000-0000-000000000005',
    'queued',
    2,
    0
  );

-- Pre-existing buildings for state-change scenarios:
--   B3: World 3, state=active  (will be suspended)
--   B4: World 4, state=suspended  (will be auto-deconstructed)
insert into
  public.settlement_buildings (
    id,
    settlement_id,
    building_blueprint_id,
    current_tier_id,
    state,
    missed_upkeep_count,
    activated_on_turn_number
  )
values
  (
    'a6800000-0000-0000-0000-000000000003',
    'a6400000-0000-0000-0000-000000000003',
    'a6500000-0000-0000-0000-000000000003',
    'a6600000-0000-0000-0000-000000000003',
    'active',
    0,
    1
  ),
  (
    'a6800000-0000-0000-0000-000000000004',
    'a6400000-0000-0000-0000-000000000004',
    'a6500000-0000-0000-0000-000000000004',
    'a6600000-0000-0000-0000-000000000004',
    'suspended',
    2,
    1
  );

-- ===========================================================================
-- All tests run as super admin
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a6100000-0000-0000-0000-000000000001","role":"authenticated"}';

-- ===========================================================================
-- TEST SCENARIO 1: single project advance
-- Project P1 advances from queued → in_progress with 5 worker-turns of progress
-- and activated_on_turn_number recorded.
-- ===========================================================================
select
  public.apply_turn_transition (
    'a6200000-0000-0000-0000-000000000001',
    3,
    jsonb_build_object(
      'constructionUpdates',
      jsonb_build_array(
        jsonb_build_object(
          'projectId',
          'a6700000-0000-0000-0000-000000000001',
          'status',
          'in_progress',
          'progressWorkerTurns',
          5,
          'activatedOnTurnNumber',
          3
        )
      )
    )
  );

select
  is (
    (
      select
        cp.status
      from
        public.construction_projects cp
      where
        cp.id = 'a6700000-0000-0000-0000-000000000001'
    ),
    'in_progress',
    'project advance: status updated to in_progress'
  );

select
  is (
    (
      select
        cp.progress_worker_turns
      from
        public.construction_projects cp
      where
        cp.id = 'a6700000-0000-0000-0000-000000000001'
    ),
    5::numeric(18, 4),
    'project advance: progress_worker_turns updated to 5'
  );

select
  is (
    (
      select
        cp.completed_in_transition_id
      from
        public.construction_projects cp
      where
        cp.id = 'a6700000-0000-0000-0000-000000000001'
    ),
    null::uuid,
    'project advance: completed_in_transition_id remains null (not yet complete)'
  );

select
  is (
    (
      select
        cp.activated_on_turn_number
      from
        public.construction_projects cp
      where
        cp.id = 'a6700000-0000-0000-0000-000000000001'
    ),
    3,
    'project advance: activated_on_turn_number set to 3'
  );

-- ===========================================================================
-- TEST SCENARIO 2: single project completion + building creation
-- Project P2 completes; a settlement_buildings row is inserted with
-- state='active', activated_on_turn_number = to_turn (4 = from 3+1),
-- and source_project_id = P2. The check_settlement_building_tier_match
-- trigger fires on INSERT — if it raises the call itself would fail.
-- ===========================================================================
select
  public.apply_turn_transition (
    'a6200000-0000-0000-0000-000000000002',
    3,
    jsonb_build_object(
      'constructionUpdates',
      jsonb_build_array(
        jsonb_build_object(
          'projectId',
          'a6700000-0000-0000-0000-000000000002',
          'status',
          'complete',
          'progressWorkerTurns',
          10,
          'activatedOnTurnNumber',
          2
        )
      ),
      'buildingsCreated',
      jsonb_build_array(
        jsonb_build_object(
          'settlementId',
          'a6400000-0000-0000-0000-000000000002',
          'buildingBlueprintId',
          'a6500000-0000-0000-0000-000000000002',
          'currentTierId',
          'a6600000-0000-0000-0000-000000000002',
          'sourceProjectId',
          'a6700000-0000-0000-0000-000000000002'
        )
      )
    )
  );

select
  is (
    (
      select
        cp.status
      from
        public.construction_projects cp
      where
        cp.id = 'a6700000-0000-0000-0000-000000000002'
    ),
    'complete',
    'project completion: status updated to complete'
  );

select
  is (
    (
      select
        cp.completed_in_transition_id
      from
        public.construction_projects cp
        join public.turn_transitions tt on tt.id = cp.completed_in_transition_id
      where
        cp.id = 'a6700000-0000-0000-0000-000000000002'
        and tt.world_id = 'a6200000-0000-0000-0000-000000000002'
    ),
    (
      select
        tt.id
      from
        public.turn_transitions tt
      where
        tt.world_id = 'a6200000-0000-0000-0000-000000000002'
        and tt.status = 'completed'
      limit
        1
    ),
    'project completion: completed_in_transition_id set to transition id'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_buildings sb
      where
        sb.settlement_id = 'a6400000-0000-0000-0000-000000000002'
        and sb.source_project_id = 'a6700000-0000-0000-0000-000000000002'
    ),
    1,
    'project completion: one settlement_buildings row created'
  );

select
  is (
    (
      select
        sb.state
      from
        public.settlement_buildings sb
      where
        sb.settlement_id = 'a6400000-0000-0000-0000-000000000002'
        and sb.source_project_id = 'a6700000-0000-0000-0000-000000000002'
    ),
    'active',
    'project completion: new building state = active'
  );

select
  is (
    (
      select
        sb.activated_on_turn_number
      from
        public.settlement_buildings sb
      where
        sb.settlement_id = 'a6400000-0000-0000-0000-000000000002'
        and sb.source_project_id = 'a6700000-0000-0000-0000-000000000002'
    ),
    4,
    'project completion: new building activated_on_turn_number = to_turn (3+1=4)'
  );

-- ===========================================================================
-- TEST SCENARIO 3: building suspend
-- Building B3 is active; state changes to suspended with missed_upkeep_count=1
-- and deactivated_in_transition_id set to the running transition.
-- ===========================================================================
select
  public.apply_turn_transition (
    'a6200000-0000-0000-0000-000000000003',
    3,
    jsonb_build_object(
      'buildingStateChanges',
      jsonb_build_array(
        jsonb_build_object(
          'buildingId',
          'a6800000-0000-0000-0000-000000000003',
          'state',
          'suspended',
          'missedUpkeepCount',
          1
        )
      )
    )
  );

select
  is (
    (
      select
        sb.state
      from
        public.settlement_buildings sb
      where
        sb.id = 'a6800000-0000-0000-0000-000000000003'
    ),
    'suspended',
    'building suspend: state updated to suspended'
  );

select
  is (
    (
      select
        sb.missed_upkeep_count
      from
        public.settlement_buildings sb
      where
        sb.id = 'a6800000-0000-0000-0000-000000000003'
    ),
    1,
    'building suspend: missed_upkeep_count updated to 1'
  );

select
  is (
    (
      select
        sb.deactivated_in_transition_id
      from
        public.settlement_buildings sb
        join public.turn_transitions tt on tt.id = sb.deactivated_in_transition_id
      where
        sb.id = 'a6800000-0000-0000-0000-000000000003'
        and tt.world_id = 'a6200000-0000-0000-0000-000000000003'
    ),
    (
      select
        tt.id
      from
        public.turn_transitions tt
      where
        tt.world_id = 'a6200000-0000-0000-0000-000000000003'
        and tt.status = 'completed'
      limit
        1
    ),
    'building suspend: deactivated_in_transition_id set to transition id'
  );

-- ===========================================================================
-- TEST SCENARIO 4: building auto-deconstruct
-- Building B4 is suspended (missed_upkeep_count=2); state changes to
-- auto_deconstructed with missed_upkeep_count=3 and deactivated_in_transition_id set.
-- ===========================================================================
select
  public.apply_turn_transition (
    'a6200000-0000-0000-0000-000000000004',
    3,
    jsonb_build_object(
      'buildingStateChanges',
      jsonb_build_array(
        jsonb_build_object(
          'buildingId',
          'a6800000-0000-0000-0000-000000000004',
          'state',
          'auto_deconstructed',
          'missedUpkeepCount',
          3
        )
      )
    )
  );

select
  is (
    (
      select
        sb.state
      from
        public.settlement_buildings sb
      where
        sb.id = 'a6800000-0000-0000-0000-000000000004'
    ),
    'auto_deconstructed',
    'building auto-deconstruct: state updated to auto_deconstructed'
  );

select
  is (
    (
      select
        sb.deactivated_in_transition_id
      from
        public.settlement_buildings sb
        join public.turn_transitions tt on tt.id = sb.deactivated_in_transition_id
      where
        sb.id = 'a6800000-0000-0000-0000-000000000004'
        and tt.world_id = 'a6200000-0000-0000-0000-000000000004'
    ),
    (
      select
        tt.id
      from
        public.turn_transitions tt
      where
        tt.world_id = 'a6200000-0000-0000-0000-000000000004'
        and tt.status = 'completed'
      limit
        1
    ),
    'building auto-deconstruct: deactivated_in_transition_id set to transition id'
  );

-- ===========================================================================
-- TEST SCENARIO 5: multi-project batch
-- Two queued projects in World 5 both advance to in_progress in a single call.
-- ===========================================================================
select
  public.apply_turn_transition (
    'a6200000-0000-0000-0000-000000000005',
    3,
    jsonb_build_object(
      'constructionUpdates',
      jsonb_build_array(
        jsonb_build_object(
          'projectId',
          'a6700000-0000-0000-0000-000000000005',
          'status',
          'in_progress',
          'progressWorkerTurns',
          3,
          'activatedOnTurnNumber',
          3
        ),
        jsonb_build_object(
          'projectId',
          'a6700000-0000-0000-0000-000000000006',
          'status',
          'in_progress',
          'progressWorkerTurns',
          2,
          'activatedOnTurnNumber',
          3
        )
      )
    )
  );

select
  is (
    (
      select
        cp.status
      from
        public.construction_projects cp
      where
        cp.id = 'a6700000-0000-0000-0000-000000000005'
    ),
    'in_progress',
    'multi-batch: project P5a status updated to in_progress'
  );

select
  is (
    (
      select
        cp.status
      from
        public.construction_projects cp
      where
        cp.id = 'a6700000-0000-0000-0000-000000000006'
    ),
    'in_progress',
    'multi-batch: project P5b status updated to in_progress'
  );

reset role;

rollback;
