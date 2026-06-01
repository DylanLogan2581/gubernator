-- pgTAP tests for public.job_definitions RLS and type-specific column constraints.
-- Run with: npx supabase test db
begin;

select
  plan (30);

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
    'a1000000-0000-0000-0000-000000000001',
    'jd-owner@example.com',
    'x',
    now(),
    '{"username":"jd_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'jd-admin@example.com',
    'x',
    now(),
    '{"username":"jd_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'jd-outsider@example.com',
    'x',
    now(),
    '{"username":"jd_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'a1000000-0000-0000-0000-000000000004',
    'jd-superadmin@example.com',
    'x',
    now(),
    '{"username":"jd_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'a1000000-0000-0000-0000-000000000004';

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'a2000000-0000-0000-0000-000000000001',
    'JD Private World',
    'a1000000-0000-0000-0000-000000000001',
    'private',
    'active'
  ),
  (
    'a2000000-0000-0000-0000-000000000002',
    'JD Public World',
    'a1000000-0000-0000-0000-000000000001',
    'public',
    'active'
  ),
  (
    'a2000000-0000-0000-0000-000000000003',
    'JD Outsider World',
    'a1000000-0000-0000-0000-000000000003',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'a2000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000002'
  );

-- Seed a standard job in the private world for write tests.
insert into
  public.job_definitions (id, world_id, name, slug, job_type, base_capacity)
values
  (
    'a3000000-0000-0000-0000-000000000001',
    'a2000000-0000-0000-0000-000000000001',
    'Farming',
    'farming',
    'standard',
    10
  );

-- Seed a standard job in the public world for outsider read tests.
insert into
  public.job_definitions (id, world_id, name, slug, job_type, base_capacity)
values
  (
    'a3000000-0000-0000-0000-000000000002',
    'a2000000-0000-0000-0000-000000000002',
    'Fishing',
    'fishing',
    'standard',
    8
  );

-- ===========================================================================
-- ANONYMOUS: no read access
-- ===========================================================================
set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.job_definitions
    ),
    0,
    'anon cannot read job_definitions'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: can read public-world jobs; cannot read private; cannot write
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.job_definitions
      where
        world_id = 'a2000000-0000-0000-0000-000000000002'
    ),
    'outsider can read job_definitions in a public world'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.job_definitions
      where
        world_id = 'a2000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read job_definitions in an inaccessible private world'
  );

select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type, base_capacity)
    values (
      'a2000000-0000-0000-0000-000000000001',
      'Outsider Job',
      'outsider-job',
      'standard',
      1
    )
  $test$,
    '42501',
    null,
    'outsider cannot insert job_definitions into an inaccessible world'
  );

update public.job_definitions
set
  name = 'Outsider Update'
where
  id = 'a3000000-0000-0000-0000-000000000001';

delete from public.job_definitions
where
  id = 'a3000000-0000-0000-0000-000000000001';

reset role;

select
  is (
    (
      select
        name
      from
        public.job_definitions
      where
        id = 'a3000000-0000-0000-0000-000000000001'
    ),
    'Farming',
    'outsider update is silently ignored by RLS'
  );

select
  ok (
    exists (
      select
        1
      from
        public.job_definitions
      where
        id = 'a3000000-0000-0000-0000-000000000001'
    ),
    'outsider delete is silently ignored by RLS'
  );

-- ===========================================================================
-- OWNER: world owners can manage job_definitions in their world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.job_definitions
      where
        world_id = 'a2000000-0000-0000-0000-000000000001'
    ),
    'owner can read job_definitions in their world'
  );

select
  lives_ok (
    $test$
    insert into public.job_definitions (id, world_id, name, slug, job_type, base_capacity)
    values (
      'a3000000-0000-0000-0000-000000000010',
      'a2000000-0000-0000-0000-000000000001',
      'Owner Job',
      'owner-job',
      'standard',
      5
    )
  $test$,
    'owner can insert job_definitions in their world'
  );

select
  lives_ok (
    $test$
    update public.job_definitions
    set name = 'Owner Updated'
    where id = 'a3000000-0000-0000-0000-000000000010'
  $test$,
    'owner can update job_definitions in their world'
  );

select
  lives_ok (
    $test$
    delete from public.job_definitions
    where id = 'a3000000-0000-0000-0000-000000000010'
  $test$,
    'owner can delete job_definitions in their world'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: explicit admins can manage job_definitions in the world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.job_definitions
      where
        world_id = 'a2000000-0000-0000-0000-000000000001'
    ),
    'world admin can read job_definitions in the administered world'
  );

select
  lives_ok (
    $test$
    insert into public.job_definitions (id, world_id, name, slug, job_type, base_capacity)
    values (
      'a3000000-0000-0000-0000-000000000011',
      'a2000000-0000-0000-0000-000000000001',
      'Admin Job',
      'admin-job',
      'standard',
      3
    )
  $test$,
    'world admin can insert job_definitions in the administered world'
  );

select
  lives_ok (
    $test$
    update public.job_definitions
    set name = 'Admin Updated'
    where id = 'a3000000-0000-0000-0000-000000000011'
  $test$,
    'world admin can update job_definitions in the administered world'
  );

select
  lives_ok (
    $test$
    delete from public.job_definitions
    where id = 'a3000000-0000-0000-0000-000000000011'
  $test$,
    'world admin can delete job_definitions in the administered world'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: can read and manage job_definitions across all worlds
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.job_definitions
      where
        world_id in (
          'a2000000-0000-0000-0000-000000000001',
          'a2000000-0000-0000-0000-000000000002',
          'a2000000-0000-0000-0000-000000000003'
        )
    ),
    2,
    'super admin can read job_definitions across all worlds'
  );

select
  lives_ok (
    $test$
    insert into public.job_definitions (id, world_id, name, slug, job_type, base_capacity)
    values (
      'a3000000-0000-0000-0000-000000000012',
      'a2000000-0000-0000-0000-000000000003',
      'Super Admin Job',
      'super-admin-job',
      'standard',
      7
    )
  $test$,
    'super admin can insert job_definitions in any world'
  );

select
  lives_ok (
    $test$
    update public.job_definitions
    set name = 'Super Admin Updated'
    where id = 'a3000000-0000-0000-0000-000000000012'
  $test$,
    'super admin can update job_definitions in any world'
  );

select
  lives_ok (
    $test$
    delete from public.job_definitions
    where id = 'a3000000-0000-0000-0000-000000000012'
  $test$,
    'super admin can delete job_definitions in any world'
  );

reset role;

-- ===========================================================================
-- TYPE-SPECIFIC COLUMN CONSTRAINTS
-- Run without a role so postgres bypasses RLS and tests CHECK constraints.
-- ===========================================================================
-- invalid job_type
select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type)
    values (
      'a2000000-0000-0000-0000-000000000001',
      'Bad Type Job',
      'bad-type-job',
      'invalid_type'
    )
  $test$,
    '23514',
    null,
    'invalid job_type rejected by check constraint'
  );

-- standard without base_capacity
select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type)
    values (
      'a2000000-0000-0000-0000-000000000001',
      'Standard No Cap',
      'standard-no-cap',
      'standard'
    )
  $test$,
    '23514',
    null,
    'standard job without base_capacity rejected by check constraint'
  );

-- construction without base_capacity
select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type)
    values (
      'a2000000-0000-0000-0000-000000000001',
      'Construction No Cap',
      'construction-no-cap',
      'construction'
    )
  $test$,
    '23514',
    null,
    'construction job without base_capacity rejected by check constraint'
  );

-- non-standard/construction job with base_capacity (deposit + base_capacity)
select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type, base_capacity)
    values (
      'a2000000-0000-0000-0000-000000000001',
      'Deposit With Cap',
      'deposit-with-cap',
      'deposit',
      5
    )
  $test$,
    '23514',
    null,
    'non-standard/construction job with base_capacity rejected by check constraint'
  );

-- trader without trader_capacity_per_worker
select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type)
    values (
      'a2000000-0000-0000-0000-000000000001',
      'Trader No Cap',
      'trader-no-cap',
      'trader'
    )
  $test$,
    '23514',
    null,
    'trader job without trader_capacity_per_worker rejected by check constraint'
  );

-- non-trader job with trader_capacity_per_worker
select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type, base_capacity, trader_capacity_per_worker)
    values (
      'a2000000-0000-0000-0000-000000000001',
      'Standard With Trader Cap',
      'standard-with-trader-cap',
      'standard',
      10,
      3
    )
  $test$,
    '23514',
    null,
    'non-trader job with trader_capacity_per_worker rejected by check constraint'
  );

-- non-deposit job with linked_deposit_type_id
select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type, base_capacity, linked_deposit_type_id)
    values (
      'a2000000-0000-0000-0000-000000000001',
      'Standard With Deposit Link',
      'standard-with-deposit-link',
      'standard',
      10,
      gen_random_uuid ()
    )
  $test$,
    '23514',
    null,
    'non-deposit job with linked_deposit_type_id rejected by check constraint'
  );

-- non-husbandry/culling job with linked_managed_population_type_id
select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type, base_capacity, linked_managed_population_type_id)
    values (
      'a2000000-0000-0000-0000-000000000001',
      'Standard With Pop Link',
      'standard-with-pop-link',
      'standard',
      10,
      gen_random_uuid ()
    )
  $test$,
    '23514',
    null,
    'non-husbandry/culling job with linked_managed_population_type_id rejected by check constraint'
  );

-- base_capacity = 0 rejected
select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type, base_capacity)
    values (
      'a2000000-0000-0000-0000-000000000001',
      'Zero Cap Job',
      'zero-cap-job',
      'standard',
      0
    )
  $test$,
    '23514',
    null,
    'base_capacity of zero rejected by check constraint'
  );

-- base_capacity negative rejected
select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type, base_capacity)
    values (
      'a2000000-0000-0000-0000-000000000001',
      'Negative Cap Job',
      'negative-cap-job',
      'standard',
      -1
    )
  $test$,
    '23514',
    null,
    'negative base_capacity rejected by check constraint'
  );

-- trader_capacity_per_worker = 0 rejected
select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type, trader_capacity_per_worker)
    values (
      'a2000000-0000-0000-0000-000000000001',
      'Zero Trader Cap Job',
      'zero-trader-cap-job',
      'trader',
      0
    )
  $test$,
    '23514',
    null,
    'trader_capacity_per_worker of zero rejected by check constraint'
  );

-- trader_capacity_per_worker negative rejected
select
  throws_ok (
    $test$
    insert into public.job_definitions (world_id, name, slug, job_type, trader_capacity_per_worker)
    values (
      'a2000000-0000-0000-0000-000000000001',
      'Negative Trader Cap Job',
      'negative-trader-cap-job',
      'trader',
      -5
    )
  $test$,
    '23514',
    null,
    'negative trader_capacity_per_worker rejected by check constraint'
  );

select
  *
from
  finish ();

rollback;
