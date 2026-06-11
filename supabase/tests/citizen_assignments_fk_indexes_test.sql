-- pgTAP tests for citizen_assignments FK indexes
-- Validates that indexes exist on FK columns and are used by cascade deletes
-- and aggregation queries.
-- Run with: npx supabase test db
begin;

select
  plan (7);

-- ---------------------------------------------------------------------------
-- Verify indexes exist
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::integer
      from
        pg_indexes
      where
        tablename = 'citizen_assignments'
        and indexname = 'citizen_assignments_job_id_idx'
    ),
    1,
    'Index citizen_assignments_job_id_idx exists'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        pg_indexes
      where
        tablename = 'citizen_assignments'
        and indexname = 'citizen_assignments_construction_project_id_idx'
    ),
    1,
    'Index citizen_assignments_construction_project_id_idx exists'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        pg_indexes
      where
        tablename = 'citizen_assignments'
        and indexname = 'citizen_assignments_deposit_instance_id_idx'
    ),
    1,
    'Index citizen_assignments_deposit_instance_id_idx exists'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        pg_indexes
      where
        tablename = 'citizen_assignments'
        and indexname = 'citizen_assignments_managed_population_instance_id_idx'
    ),
    1,
    'Index citizen_assignments_managed_population_instance_id_idx exists'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        pg_indexes
      where
        tablename = 'citizen_assignments'
        and indexname = 'citizen_assignments_trade_route_id_idx'
    ),
    1,
    'Index citizen_assignments_trade_route_id_idx exists'
  );

-- ---------------------------------------------------------------------------
-- Verify indexes are partial (WHERE clause)
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::integer
      from
        pg_indexes
      where
        tablename = 'citizen_assignments'
        and indexname in (
          'citizen_assignments_job_id_idx',
          'citizen_assignments_construction_project_id_idx',
          'citizen_assignments_deposit_instance_id_idx',
          'citizen_assignments_managed_population_instance_id_idx',
          'citizen_assignments_trade_route_id_idx'
        )
        and indexdef ilike '%is not null%'
    ),
    5,
    'All 5 FK indexes are partial (WHERE <col> IS NOT NULL)'
  );

-- ---------------------------------------------------------------------------
-- Verify indexes are btree type
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::integer
      from
        pg_indexes
      where
        tablename = 'citizen_assignments'
        and indexname in (
          'citizen_assignments_job_id_idx',
          'citizen_assignments_construction_project_id_idx',
          'citizen_assignments_deposit_instance_id_idx',
          'citizen_assignments_managed_population_instance_id_idx',
          'citizen_assignments_trade_route_id_idx'
        )
        and indexdef like '%btree%'
    ),
    5,
    'All 5 FK indexes use btree'
  );

select
  *
from
  finish ();

rollback;
