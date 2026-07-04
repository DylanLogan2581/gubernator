-- pgTAP tests for previously-missing FK indexes on trade_route_legs and
-- event_effects. See 20260815000000_add_missing_fk_indexes.sql.
-- Run with: npx supabase test db
begin;

select
  plan (5);

-- ===========================================================================
-- Test 1: trade_route_legs_resource_id_idx exists.
-- ===========================================================================
select
  ok (
    exists (
      select
        1
      from
        pg_indexes
      where
        schemaname = 'public'
        and tablename = 'trade_route_legs'
        and indexname = 'trade_route_legs_resource_id_idx'
    ),
    'Index trade_route_legs_resource_id_idx exists on trade_route_legs'
  );

-- ===========================================================================
-- Test 2: event_effects_managed_population_instance_id_idx exists.
-- ===========================================================================
select
  ok (
    exists (
      select
        1
      from
        pg_indexes
      where
        schemaname = 'public'
        and tablename = 'event_effects'
        and indexname = 'event_effects_managed_population_instance_id_idx'
    ),
    'Index event_effects_managed_population_instance_id_idx exists on event_effects'
  );

-- ===========================================================================
-- Test 3: managed_population_instance_id index is partial (WHERE NOT NULL).
-- ===========================================================================
select
  ok (
    exists (
      select
        1
      from
        pg_indexes
      where
        schemaname = 'public'
        and tablename = 'event_effects'
        and indexname = 'event_effects_managed_population_instance_id_idx'
        and indexdef like '%WHERE%managed_population_instance_id IS NOT NULL%'
    ),
    'Index event_effects_managed_population_instance_id_idx has WHERE managed_population_instance_id IS NOT NULL clause'
  );

-- ===========================================================================
-- Test 4: event_effects_deposit_instance_id_idx exists.
-- ===========================================================================
select
  ok (
    exists (
      select
        1
      from
        pg_indexes
      where
        schemaname = 'public'
        and tablename = 'event_effects'
        and indexname = 'event_effects_deposit_instance_id_idx'
    ),
    'Index event_effects_deposit_instance_id_idx exists on event_effects'
  );

-- ===========================================================================
-- Test 5: deposit_instance_id index is partial (WHERE NOT NULL).
-- ===========================================================================
select
  ok (
    exists (
      select
        1
      from
        pg_indexes
      where
        schemaname = 'public'
        and tablename = 'event_effects'
        and indexname = 'event_effects_deposit_instance_id_idx'
        and indexdef like '%WHERE%deposit_instance_id IS NOT NULL%'
    ),
    'Index event_effects_deposit_instance_id_idx has WHERE deposit_instance_id IS NOT NULL clause'
  );

select
  *
from
  finish ();

rollback;
