-- pgTAP tests for public.nations.government_type.
-- Run with: npx supabase test db
begin;

select
  plan (5);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into
  public.worlds (id, name, status)
values
  (
    '64000000-0000-0000-0000-000000000001',
    'Government Type World',
    'active'
  );

-- ===========================================================================
-- DEFAULT
-- ===========================================================================
select
  lives_ok (
    $test$
    insert into public.nations (id, world_id, name)
    values (
      '65000000-0000-0000-0000-000000000001',
      '64000000-0000-0000-0000-000000000001',
      'Default Government Nation'
    )
  $test$,
    'nations can be inserted without an explicit government_type'
  );

select
  is (
    (
      select
        government_type
      from
        public.nations
      where
        id = '65000000-0000-0000-0000-000000000001'
    ),
    'monarchy',
    'government_type defaults to monarchy'
  );

-- ===========================================================================
-- VALID VALUES
-- ===========================================================================
select
  lives_ok (
    $test$
    insert into public.nations (id, world_id, name, government_type)
    values (
      '65000000-0000-0000-0000-000000000002',
      '64000000-0000-0000-0000-000000000001',
      'Republic Nation',
      'republic'
    )
  $test$,
    'nations accept a valid government_type on insert'
  );

select
  lives_ok (
    $test$
    update public.nations
    set government_type = 'confederation'
    where id = '65000000-0000-0000-0000-000000000002'
  $test$,
    'government_type can be updated to another valid value'
  );

-- ===========================================================================
-- INVALID VALUES
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.nations (id, world_id, name, government_type)
    values (
      '65000000-0000-0000-0000-000000000003',
      '64000000-0000-0000-0000-000000000001',
      'Invalid Government Nation',
      'anarchy'
    )
  $test$,
    '23514',
    null,
    'government_type rejects values outside the allowed set'
  );

rollback;
