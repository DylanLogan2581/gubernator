-- pgTAP tests for auto_exhaust_deposit_at_zero_resources trigger.
-- Run with: npx supabase test db
begin;

select
  plan (5);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all ac-prefixed, unique to this file):
--   ac1xxxxx = users          ac2xxxxx = worlds
--   ac3xxxxx = nations        ac4xxxxx = settlements
--   ac5xxxxx = deposit_types  ac6xxxxx = resources
--   ac7xxxxx = citizens       ac8xxxxx = job_definitions
--   ac9xxxxx = deposit_instances
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
    'ac100000-0000-0000-0000-000000000001',
    'auto-exhaust-owner@example.com',
    'x',
    now(),
    '{"username":"auto_exhaust_owner"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'ac200000-0000-0000-0000-000000000001',
    'Auto Exhaust World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'ac200000-0000-0000-0000-000000000001',
    'ac100000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'ac300000-0000-0000-0000-000000000001',
    'ac200000-0000-0000-0000-000000000001',
    'Auto Exhaust Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'ac400000-0000-0000-0000-000000000001',
    'ac300000-0000-0000-0000-000000000001',
    'Auto Exhaust Settlement'
  );

-- Job definition needed for deposit type FK
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'ac800000-0000-0000-0000-000000000001',
    'ac200000-0000-0000-0000-000000000001',
    'Auto Exhaust Job',
    'auto-exhaust-job',
    'deposit'
  );

-- Resource for deposit
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'ac600000-0000-0000-0000-000000000001',
    'ac200000-0000-0000-0000-000000000001',
    'Iron',
    'iron'
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
    'ac500000-0000-0000-0000-000000000001',
    'ac200000-0000-0000-0000-000000000001',
    'Iron Seam',
    'iron-seam',
    'ac800000-0000-0000-0000-000000000001',
    10
  );

-- Active deposit for auto-exhaust test
insert into
  public.deposit_instances (id, settlement_id, deposit_type_id, name, status)
values
  (
    'ac900000-0000-0000-0000-000000000001',
    'ac400000-0000-0000-0000-000000000001',
    'ac500000-0000-0000-0000-000000000001',
    'Iron Alpha',
    'active'
  );

-- Resource with 10 total, 5 remaining
insert into
  public.deposit_instance_resources (
    id,
    deposit_instance_id,
    resource_id,
    initial_quantity,
    remaining_quantity
  )
values
  (
    'ac900010-0000-0000-0000-000000000001',
    'ac900000-0000-0000-0000-000000000001',
    'ac600000-0000-0000-0000-000000000001',
    10.0,
    5.0
  );

-- ===========================================================================
-- INITIAL STATE: deposit is active, resource has remaining_quantity = 5
-- ===========================================================================
select
  is (
    (
      select
        di.status
      from
        public.deposit_instances di
      where
        di.id = 'ac900000-0000-0000-0000-000000000001'
    ),
    'active',
    'deposit starts as active'
  );

select
  is (
    (
      select
        dir.remaining_quantity
      from
        public.deposit_instance_resources dir
      where
        dir.id = 'ac900010-0000-0000-0000-000000000001'
    ),
    5.0,
    'resource starts with remaining_quantity = 5'
  );

-- ===========================================================================
-- UPDATE TO ZERO: set remaining_quantity to 0, trigger auto-exhaust
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ac100000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.set_deposit_instance_resource_quantities(
      'ac900010-0000-0000-0000-000000000001',
      10.0,
      0.0
    )
    $test$,
    'world admin can set remaining_quantity to 0'
  );

reset role;

-- ===========================================================================
-- VERIFY AUTO-EXHAUST: deposit status changed to removed, resource is zero
-- ===========================================================================
select
  is (
    (
      select
        dir.remaining_quantity
      from
        public.deposit_instance_resources dir
      where
        dir.id = 'ac900010-0000-0000-0000-000000000001'
    ),
    0.0,
    'resource remaining_quantity is now 0'
  );

select
  is (
    (
      select
        di.status
      from
        public.deposit_instances di
      where
        di.id = 'ac900000-0000-0000-0000-000000000001'
    ),
    'removed',
    'deposit auto-exhausted to removed when all resources reached zero'
  );

select
  *
from
  finish ();

rollback;
