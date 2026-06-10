-- pgTAP tests for job_definitions FK covering indexes.
-- Covers: index existence and partial index design (WHERE NOT NULL).
-- Run with: npx supabase test db
begin;

select
  plan (4);

-- ===========================================================================
-- Test 1: Index job_definitions_linked_deposit_type_id_idx exists.
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
        and tablename = 'job_definitions'
        and indexname = 'job_definitions_linked_deposit_type_id_idx'
    ),
    'Index job_definitions_linked_deposit_type_id_idx exists on job_definitions'
  );

-- ===========================================================================
-- Test 2: Deposit type index is partial (WHERE NOT NULL).
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
        and tablename = 'job_definitions'
        and indexname = 'job_definitions_linked_deposit_type_id_idx'
        and indexdef like '%WHERE%linked_deposit_type_id IS NOT NULL%'
    ),
    'Index job_definitions_linked_deposit_type_id_idx has WHERE linked_deposit_type_id IS NOT NULL clause'
  );

-- ===========================================================================
-- Test 3: Index job_definitions_linked_managed_population_type_id_idx exists.
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
        and tablename = 'job_definitions'
        and indexname = 'job_definitions_linked_managed_population_type_id_idx'
    ),
    'Index job_definitions_linked_managed_population_type_id_idx exists on job_definitions'
  );

-- ===========================================================================
-- Test 4: Managed population index is partial (WHERE NOT NULL).
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
        and tablename = 'job_definitions'
        and indexname = 'job_definitions_linked_managed_population_type_id_idx'
        and indexdef like '%WHERE%linked_managed_population_type_id IS NOT NULL%'
    ),
    'Index job_definitions_linked_managed_population_type_id_idx has WHERE linked_managed_population_type_id IS NOT NULL clause'
  );

select
  *
from
  finish ();

rollback;
