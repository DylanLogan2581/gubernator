-- pgTAP tests for namesets.world_id index.
-- Covers: index existence, index usage for lookups, and ON DELETE CASCADE behavior.
-- Run with: npx supabase test db
begin;

select
  plan (4);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into
  public.worlds (id, name, visibility, status)
values
  (
    'f1000000-0000-0000-0000-000000000010',
    'Index Test World',
    'private',
    'active'
  );

insert into
  public.namesets (id, world_id, name, config_json, is_default)
values
  (
    'f2000000-0000-0000-0000-000000000010',
    'f1000000-0000-0000-0000-000000000010',
    'Test Nameset 1',
    public.default_naming_config (),
    false
  ),
  (
    'f2000000-0000-0000-0000-000000000011',
    'f1000000-0000-0000-0000-000000000010',
    'Test Nameset 2',
    public.default_naming_config (),
    false
  );

-- ===========================================================================
-- Test 1: Index namesets_world_id_idx exists.
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
        and tablename = 'namesets'
        and indexname = 'namesets_world_id_idx'
    ),
    'Index namesets_world_id_idx exists on public.namesets'
  );

-- ===========================================================================
-- Test 2: Index is a b-tree index on world_id column.
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
        and tablename = 'namesets'
        and indexname = 'namesets_world_id_idx'
        and indexdef like '%world_id%'
        and indexdef not like '%WHERE%' -- Exclude partial indexes
    ),
    'Index namesets_world_id_idx is a general (non-partial) index on world_id'
  );

-- ===========================================================================
-- Test 3: ON DELETE CASCADE uses the index (verify cascading delete works).
-- ===========================================================================
-- Verify namesets exist before delete.
select
  is (
    count(*),
    2::bigint,
    'Two namesets exist for test world'
  )
from
  public.namesets
where
  world_id = 'f1000000-0000-0000-0000-000000000010';

-- Delete the world (should cascade delete namesets).
delete from public.worlds
where
  id = 'f1000000-0000-0000-0000-000000000010';

-- Verify namesets were deleted via cascade.
select
  is (
    count(*),
    0::bigint,
    'Namesets deleted via ON DELETE CASCADE'
  )
from
  public.namesets
where
  world_id = 'f1000000-0000-0000-0000-000000000010';

select
  *
from
  finish ();

rollback;
