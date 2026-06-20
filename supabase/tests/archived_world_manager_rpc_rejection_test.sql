-- pgTAP tests: every manager-facing mutation RPC rejects an archived world.
-- Acceptance criterion #2 for issue #799.
--
-- Enumerates all 31 RPCs patched by the archive_guard_consolidation migration.
-- For each, asserts throws_ok(P0001) when the target world is archived.
-- The archive guard fires after the auth check but before state/entity checks,
-- so entity state does not need to match the RPC's expected pre-condition.
--
-- Run with: npx supabase test db
--
-- UUID prefix map (all be-prefixed ranges, unique to this file):
--   be100000 = users        be200000 = worlds
--   be300000 = nations      be400000 = settlements
--   be500000 = resources    be600000 = job_definitions
--   be700000 = building_blueprints    be800000 = building_blueprint_tiers
--   be900000 = deposit_types          bea00000 = managed_population_types (unused row)
--   beb00000 = settlement_buildings   bec00000 = deposit_instances
--   bed00000 = construction_projects  bee00000 = event_groups
--   bef00000 = events
begin;

select
  plan (31);

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
    'be100000-0000-0000-0000-000000000001',
    'agmr-superadmin@example.com',
    'x',
    now(),
    '{"username":"agmr_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'be100000-0000-0000-0000-000000000001';

-- Archived world
insert into
  public.worlds (id, name, visibility, status, archived_at)
values
  (
    'be200000-0000-0000-0000-000000000001',
    'AGMR Archived World',
    'private',
    'archived',
    now()
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'be300000-0000-0000-0000-000000000001',
    'be200000-0000-0000-0000-000000000001',
    'AGMR Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'be400000-0000-0000-0000-000000000001',
    'be300000-0000-0000-0000-000000000001',
    'AGMR Settlement'
  );

-- Building blueprint + tier (needed for settlement_building and construction_project FKs)
insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'be700000-0000-0000-0000-000000000001',
    'be200000-0000-0000-0000-000000000001',
    'AGMR Watchtower',
    'agmr-watchtower'
  );

insert into
  public.building_blueprint_tiers (
    id,
    building_blueprint_id,
    tier_number,
    worker_turns_required
  )
values
  (
    'be800000-0000-0000-0000-000000000001',
    'be700000-0000-0000-0000-000000000001',
    1,
    10
  );

-- Settlement building (active state is fine; archive check fires before state check)
insert into
  public.settlement_buildings (
    id,
    settlement_id,
    building_blueprint_id,
    current_tier_id,
    state,
    activated_on_turn_number
  )
values
  (
    'beb00000-0000-0000-0000-000000000001',
    'be400000-0000-0000-0000-000000000001',
    'be700000-0000-0000-0000-000000000001',
    'be800000-0000-0000-0000-000000000001',
    'active',
    1
  );

-- Job definition + deposit type (chain needed for deposit_instance FK)
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'be600000-0000-0000-0000-000000000001',
    'be200000-0000-0000-0000-000000000001',
    'AGMR Mining',
    'agmr-mining',
    'deposit'
  );

insert into
  public.deposit_types (
    id,
    world_id,
    name,
    slug,
    job_id,
    output_units_per_worker
  )
values
  (
    'be900000-0000-0000-0000-000000000001',
    'be200000-0000-0000-0000-000000000001',
    'AGMR Iron Seam',
    'agmr-iron-seam',
    'be600000-0000-0000-0000-000000000001',
    10
  );

-- Deposit instance (active; archive check fires before status check)
insert into
  public.deposit_instances (id, settlement_id, deposit_type_id, name, status)
values
  (
    'bec00000-0000-0000-0000-000000000001',
    'be400000-0000-0000-0000-000000000001',
    'be900000-0000-0000-0000-000000000001',
    'AGMR Iron Alpha',
    'active'
  );

-- Construction project (queued; archive check fires before terminal-status check)
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
    'bed00000-0000-0000-0000-000000000001',
    'be400000-0000-0000-0000-000000000001',
    'be700000-0000-0000-0000-000000000001',
    'be800000-0000-0000-0000-000000000001',
    'queued',
    1,
    0
  );

-- Event group with one cancelled event (needed so delete_event_or_group passes
-- its pre-archive-check state gate: no non-cancelled events in the group)
insert into
  public.event_groups (id, world_id, name, created_during_turn_number)
values
  (
    'bee00000-0000-0000-0000-000000000001',
    'be200000-0000-0000-0000-000000000001',
    'AGMR Test Group',
    0
  );

insert into
  public.events (
    id,
    world_id,
    event_group_id,
    name,
    effect_type,
    status,
    activate_on_transition_after_turn_number
  )
values
  (
    'bef00000-0000-0000-0000-000000000001',
    'be200000-0000-0000-0000-000000000001',
    'bee00000-0000-0000-0000-000000000001',
    'AGMR Cancelled Event',
    'population_loss',
    'cancelled',
    0
  );

-- ===========================================================================
-- All tests run as authenticated superadmin
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"be100000-0000-0000-0000-000000000001","role":"authenticated"}';

-- ===========================================================================
-- 1. soft_delete_resource rejects archived world
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.soft_delete_resource (
      'be500000-0000-0000-0000-000000000001',
      'be200000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'soft_delete_resource rejects archived world'
  );

-- ===========================================================================
-- 2. restore_resource rejects archived world
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.restore_resource (
      'be500000-0000-0000-0000-000000000001',
      'be200000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'restore_resource rejects archived world'
  );

-- ===========================================================================
-- 3. hard_delete_resource rejects archived world
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.hard_delete_resource (
      'be500000-0000-0000-0000-000000000001',
      'be200000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'hard_delete_resource rejects archived world'
  );

-- ===========================================================================
-- 4. soft_delete_job_definition rejects archived world
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.soft_delete_job_definition (
      'be600000-0000-0000-0000-000000000001',
      'be200000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'soft_delete_job_definition rejects archived world'
  );

-- ===========================================================================
-- 5. restore_job_definition rejects archived world
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.restore_job_definition (
      'be600000-0000-0000-0000-000000000001',
      'be200000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'restore_job_definition rejects archived world'
  );

-- ===========================================================================
-- 6. hard_delete_job_definition rejects archived world
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.hard_delete_job_definition (
      'be600000-0000-0000-0000-000000000001',
      'be200000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'hard_delete_job_definition rejects archived world'
  );

-- ===========================================================================
-- 7. soft_delete_building_blueprint rejects archived world
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.soft_delete_building_blueprint (
      'be700000-0000-0000-0000-000000000001',
      'be200000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'soft_delete_building_blueprint rejects archived world'
  );

-- ===========================================================================
-- 8. restore_building_blueprint rejects archived world
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.restore_building_blueprint (
      'be700000-0000-0000-0000-000000000001',
      'be200000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'restore_building_blueprint rejects archived world'
  );

-- ===========================================================================
-- 9. hard_delete_building_blueprint rejects archived world
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.hard_delete_building_blueprint (
      'be700000-0000-0000-0000-000000000001',
      'be200000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'hard_delete_building_blueprint rejects archived world'
  );

-- ===========================================================================
-- 10. soft_delete_deposit_type rejects archived world
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.soft_delete_deposit_type (
      'be900000-0000-0000-0000-000000000001',
      'be200000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'soft_delete_deposit_type rejects archived world'
  );

-- ===========================================================================
-- 11. restore_deposit_type rejects archived world
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.restore_deposit_type (
      'be900000-0000-0000-0000-000000000001',
      'be200000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'restore_deposit_type rejects archived world'
  );

-- ===========================================================================
-- 12. hard_delete_deposit_type rejects archived world
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.hard_delete_deposit_type (
      'be900000-0000-0000-0000-000000000001',
      'be200000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'hard_delete_deposit_type rejects archived world'
  );

-- ===========================================================================
-- 13. soft_delete_managed_population_type rejects archived world
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.soft_delete_managed_population_type (
      'bea00000-0000-0000-0000-000000000001',
      'be200000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'soft_delete_managed_population_type rejects archived world'
  );

-- ===========================================================================
-- 14. restore_managed_population_type rejects archived world
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.restore_managed_population_type (
      'bea00000-0000-0000-0000-000000000001',
      'be200000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'restore_managed_population_type rejects archived world'
  );

-- ===========================================================================
-- 15. hard_delete_managed_population_type rejects archived world
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.hard_delete_managed_population_type (
      'bea00000-0000-0000-0000-000000000001',
      'be200000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'hard_delete_managed_population_type rejects archived world'
  );

-- ===========================================================================
-- 16. restore_settlement_building rejects archived world
--     (building beb exists in the archived world; archive guard fires before
--      the state-must-be-deconstructed check)
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.restore_settlement_building (
      'beb00000-0000-0000-0000-000000000001',
      'be200000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'restore_settlement_building rejects archived world'
  );

-- ===========================================================================
-- 17. hard_delete_settlement_building rejects archived world
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.hard_delete_settlement_building (
      'beb00000-0000-0000-0000-000000000001',
      'be200000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'hard_delete_settlement_building rejects archived world'
  );

-- ===========================================================================
-- 18. restore_deposit_instance rejects archived world
--     (deposit instance bec exists in archived world; archive guard fires
--      before the status-must-be-removed check)
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.restore_deposit_instance (
      'bec00000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'restore_deposit_instance rejects archived world'
  );

-- ===========================================================================
-- 19. hard_delete_deposit_instance rejects archived world
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.hard_delete_deposit_instance (
      'bec00000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'hard_delete_deposit_instance rejects archived world'
  );

-- ===========================================================================
-- 20. set_settlement_stockpile_quantity rejects archived world
--     (settlement be4 exists in archived world; archive guard fires before
--      the resource-must-exist check)
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.set_settlement_stockpile_quantity (
      'be400000-0000-0000-0000-000000000001',
      'be500000-0000-0000-0000-000000000001',
      100
    )
    $test$,
    'P0001',
    null,
    'set_settlement_stockpile_quantity rejects archived world'
  );

-- ===========================================================================
-- 21. cancel_construction_project rejects archived world
--     (project bed exists in archived world's settlement; archive guard fires
--      before the must-not-be-terminal status check)
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.cancel_construction_project (
      'bed00000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'cancel_construction_project rejects archived world'
  );

-- ===========================================================================
-- 22. resume_construction_project rejects archived world
--     (project bed is queued, not cancelled; archive guard fires before
--      the must-be-cancelled check)
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.resume_construction_project (
      'bed00000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'resume_construction_project rejects archived world'
  );

-- ===========================================================================
-- 23. hard_delete_construction_project rejects archived world
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.hard_delete_construction_project (
      'bed00000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'hard_delete_construction_project rejects archived world'
  );

-- ===========================================================================
-- 24. reorder_construction_projects rejects archived world
--     (settlement be4 resolves to archived world; archive guard fires before
--      the position-count validation)
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.reorder_construction_projects (
      'be400000-0000-0000-0000-000000000001',
      '[]'::jsonb
    )
    $test$,
    'P0001',
    null,
    'reorder_construction_projects rejects archived world'
  );

-- ===========================================================================
-- 25. set_bulk_construction_assignment rejects archived world
--     (project bed resolves to archived world; archive guard fires before
--      the must-not-be-terminal check)
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.set_bulk_construction_assignment (
      'bed00000-0000-0000-0000-000000000001',
      0
    )
    $test$,
    'P0001',
    null,
    'set_bulk_construction_assignment rejects archived world'
  );

-- ===========================================================================
-- 26. set_bulk_construction_pool rejects archived world
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.set_bulk_construction_pool (
      'be400000-0000-0000-0000-000000000001',
      0
    )
    $test$,
    'P0001',
    null,
    'set_bulk_construction_pool rejects archived world'
  );

-- ===========================================================================
-- 27. set_per_target_assignment rejects archived world
--     (settlement be4 resolves to archived world; archive guard fires before
--      target-deposit lookup)
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.set_per_target_assignment (
      'be400000-0000-0000-0000-000000000001',
      'deposit',
      'bec00000-0000-0000-0000-000000000001',
      array[]::uuid[]
    )
    $test$,
    'P0001',
    null,
    'set_per_target_assignment rejects archived world'
  );

-- ===========================================================================
-- 28. cancel_event_or_group rejects archived world
--     (event group bee resolves to archived world)
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.cancel_event_or_group (
      null,
      'bee00000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'cancel_event_or_group rejects archived world'
  );

-- ===========================================================================
-- 29. delete_event_or_group rejects archived world
--     (event group bee has only cancelled events, so the pre-archive state
--      gate passes; archive guard then fires)
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.delete_event_or_group (
      null,
      'bee00000-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'delete_event_or_group rejects archived world'
  );

-- ===========================================================================
-- 30. update_event_group_with_events rejects archived world
--     (event group bee resolves to archived world; archive guard fires before
--      input-length validation)
-- ===========================================================================
select
  throws_ok (
    $test$
    select * from public.update_event_group_with_events (
      'bee00000-0000-0000-0000-000000000001',
      'AGMR Test Group Updated',
      null,
      '[]'::jsonb,
      'instant',
      null,
      0,
      false,
      null
    )
    $test$,
    'P0001',
    null,
    'update_event_group_with_events rejects archived world'
  );

-- ===========================================================================
-- 31. upsert_world_retention_config rejects archived world
--     (superadmin-only; archive guard fires immediately after auth check)
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.upsert_world_retention_config (
      'be200000-0000-0000-0000-000000000001',
      10,
      10
    )
    $test$,
    'P0001',
    null,
    'upsert_world_retention_config rejects archived world'
  );

reset role;

select
  finish ();

rollback;
