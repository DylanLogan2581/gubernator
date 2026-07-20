-- pgTAP tests for the tier_number column on deposit_type_jobs (#1308).
-- Covers: default value, positivity check, per-deposit-type uniqueness, and
-- distinct deposit types allowed to reuse the same tier number.
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
    'd2000000-0000-0000-0000-000000000001',
    'DTT World',
    'active'
  );

insert into
  public.job_definitions (id, world_id, name, slug, job_type)
select
  format(
    'd4000000-0000-0000-0000-%s',
    lpad(n::text, 12, '0')
  )::uuid,
  'd2000000-0000-0000-0000-000000000001',
  format('Mining %s', n),
  format('mining-%s', n),
  'deposit'
from
  generate_series(1, 4) as n;

insert into
  public.deposit_types (id, world_id, name, slug)
values
  (
    'd6000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'Iron Deposit',
    'iron-deposit'
  ),
  (
    'd6000000-0000-0000-0000-000000000002',
    'd2000000-0000-0000-0000-000000000001',
    'Copper Deposit',
    'copper-deposit'
  );

-- ===========================================================================
-- DEFAULT VALUE
-- ===========================================================================
select
  results_eq (
    $test$
    insert into public.deposit_type_jobs (id, deposit_type_id, job_id, output_units_per_worker)
    values (
      'd5000000-0000-0000-0000-000000000001',
      'd6000000-0000-0000-0000-000000000001',
      'd4000000-0000-0000-0000-000000000001', 5
    )
    returning tier_number
    $test$,
    $expected$ values (1) $expected$,
    'tier_number defaults to 1 when omitted'
  );

-- ===========================================================================
-- CHECK CONSTRAINT
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.deposit_type_jobs (deposit_type_id, job_id, tier_number, output_units_per_worker)
    values (
      'd6000000-0000-0000-0000-000000000001',
      'd4000000-0000-0000-0000-000000000002', 0, 5
    )
    $test$,
    '23514',
    null,
    'tier_number below 1 is rejected'
  );

-- ===========================================================================
-- UNIQUENESS PER DEPOSIT TYPE
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.deposit_type_jobs (deposit_type_id, job_id, tier_number, output_units_per_worker)
    values (
      'd6000000-0000-0000-0000-000000000001',
      'd4000000-0000-0000-0000-000000000002', 1, 5
    )
    $test$,
    '23505',
    null,
    'duplicate tier_number for the same deposit type is rejected'
  );

select
  lives_ok (
    $test$
    insert into public.deposit_type_jobs (deposit_type_id, job_id, tier_number, output_units_per_worker)
    values (
      'd6000000-0000-0000-0000-000000000001',
      'd4000000-0000-0000-0000-000000000002', 2, 8
    )
    $test$,
    'a second, distinct tier_number for the same deposit type is accepted'
  );

-- Different deposit types may each have their own tier_number 1.
select
  lives_ok (
    $test$
    insert into public.deposit_type_jobs (deposit_type_id, job_id, tier_number, output_units_per_worker)
    values (
      'd6000000-0000-0000-0000-000000000002',
      'd4000000-0000-0000-0000-000000000003', 1, 5
    )
    $test$,
    'the same tier_number is accepted on a different deposit type'
  );

select
  *
from
  finish ();

rollback;
