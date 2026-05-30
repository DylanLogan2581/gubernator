-- pgTAP tests for public.deposit_types RLS, unique job linkage, and column
-- constraints.
-- Run with: npx supabase test db
begin;

select
  plan (20);

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
    'dt-owner@example.com',
    'x',
    now(),
    '{"username":"dt_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'dt-admin@example.com',
    'x',
    now(),
    '{"username":"dt_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'dt-outsider@example.com',
    'x',
    now(),
    '{"username":"dt_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'a1000000-0000-0000-0000-000000000004',
    'dt-superadmin@example.com',
    'x',
    now(),
    '{"username":"dt_superadmin"}'::jsonb,
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
    'DT Private World',
    'a1000000-0000-0000-0000-000000000001',
    'private',
    'active'
  ),
  (
    'a2000000-0000-0000-0000-000000000002',
    'DT Public World',
    'a1000000-0000-0000-0000-000000000001',
    'public',
    'active'
  ),
  (
    'a2000000-0000-0000-0000-000000000003',
    'DT Outsider World',
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

-- Deposit jobs needed for the job_id FK on deposit_types.
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    'a3000000-0000-0000-0000-000000000001',
    'a2000000-0000-0000-0000-000000000001',
    'Mining',
    'mining',
    'deposit'
  ),
  (
    'a3000000-0000-0000-0000-000000000002',
    'a2000000-0000-0000-0000-000000000002',
    'Quarrying',
    'quarrying',
    'deposit'
  ),
  -- Extra jobs for owner / admin / super-admin write tests.
  (
    'a3000000-0000-0000-0000-000000000010',
    'a2000000-0000-0000-0000-000000000001',
    'Owner Mining',
    'owner-mining',
    'deposit'
  ),
  (
    'a3000000-0000-0000-0000-000000000011',
    'a2000000-0000-0000-0000-000000000001',
    'Admin Mining',
    'admin-mining',
    'deposit'
  ),
  (
    'a3000000-0000-0000-0000-000000000012',
    'a2000000-0000-0000-0000-000000000003',
    'Super Admin Mining',
    'super-admin-mining',
    'deposit'
  ),
  -- Extra jobs for constraint tests.
  (
    'a3000000-0000-0000-0000-000000000020',
    'a2000000-0000-0000-0000-000000000001',
    'Constraint Job A',
    'constraint-job-a',
    'deposit'
  ),
  (
    'a3000000-0000-0000-0000-000000000021',
    'a2000000-0000-0000-0000-000000000001',
    'Constraint Job B',
    'constraint-job-b',
    'deposit'
  );

-- Seed a deposit type in the private world for write tests.
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
    'a4000000-0000-0000-0000-000000000001',
    'a2000000-0000-0000-0000-000000000001',
    'Iron Deposit',
    'iron-deposit',
    'a3000000-0000-0000-0000-000000000001',
    5
  );

-- Seed a deposit type in the public world for outsider read tests.
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
    'a4000000-0000-0000-0000-000000000002',
    'a2000000-0000-0000-0000-000000000002',
    'Stone Deposit',
    'stone-deposit',
    'a3000000-0000-0000-0000-000000000002',
    3
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
        public.deposit_types
    ),
    0,
    'anon cannot read deposit_types'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: can read public-world deposit types; cannot read private; cannot write
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
        public.deposit_types
      where
        world_id = 'a2000000-0000-0000-0000-000000000002'
    ),
    'outsider can read deposit_types in a public world'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.deposit_types
      where
        world_id = 'a2000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read deposit_types in an inaccessible private world'
  );

select
  throws_ok (
    $test$
    insert into public.deposit_types (world_id, name, slug, job_id, output_units_per_worker)
    values (
      'a2000000-0000-0000-0000-000000000001',
      'Outsider Deposit',
      'outsider-deposit',
      'a3000000-0000-0000-0000-000000000010',
      1
    )
  $test$,
    '42501',
    null,
    'outsider cannot insert deposit_types into an inaccessible world'
  );

update public.deposit_types
set
  name = 'Outsider Update'
where
  id = 'a4000000-0000-0000-0000-000000000001';

delete from public.deposit_types
where
  id = 'a4000000-0000-0000-0000-000000000001';

reset role;

select
  is (
    (
      select
        name
      from
        public.deposit_types
      where
        id = 'a4000000-0000-0000-0000-000000000001'
    ),
    'Iron Deposit',
    'outsider update is silently ignored by RLS'
  );

select
  ok (
    exists (
      select
        1
      from
        public.deposit_types
      where
        id = 'a4000000-0000-0000-0000-000000000001'
    ),
    'outsider delete is silently ignored by RLS'
  );

-- ===========================================================================
-- OWNER: world owners can manage deposit_types in their world
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
        public.deposit_types
      where
        world_id = 'a2000000-0000-0000-0000-000000000001'
    ),
    'owner can read deposit_types in their world'
  );

select
  lives_ok (
    $test$
    insert into public.deposit_types (id, world_id, name, slug, job_id, output_units_per_worker)
    values (
      'a4000000-0000-0000-0000-000000000010',
      'a2000000-0000-0000-0000-000000000001',
      'Owner Deposit',
      'owner-deposit',
      'a3000000-0000-0000-0000-000000000010',
      10
    )
  $test$,
    'owner can insert deposit_types in their world'
  );

select
  lives_ok (
    $test$
    update public.deposit_types
    set name = 'Owner Updated'
    where id = 'a4000000-0000-0000-0000-000000000010'
  $test$,
    'owner can update deposit_types in their world'
  );

select
  lives_ok (
    $test$
    delete from public.deposit_types
    where id = 'a4000000-0000-0000-0000-000000000010'
  $test$,
    'owner can delete deposit_types in their world'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: explicit admins can manage deposit_types in the world
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
        public.deposit_types
      where
        world_id = 'a2000000-0000-0000-0000-000000000001'
    ),
    'world admin can read deposit_types in the administered world'
  );

select
  lives_ok (
    $test$
    insert into public.deposit_types (id, world_id, name, slug, job_id, output_units_per_worker)
    values (
      'a4000000-0000-0000-0000-000000000011',
      'a2000000-0000-0000-0000-000000000001',
      'Admin Deposit',
      'admin-deposit',
      'a3000000-0000-0000-0000-000000000011',
      8
    )
  $test$,
    'world admin can insert deposit_types in the administered world'
  );

select
  lives_ok (
    $test$
    update public.deposit_types
    set name = 'Admin Updated'
    where id = 'a4000000-0000-0000-0000-000000000011'
  $test$,
    'world admin can update deposit_types in the administered world'
  );

select
  lives_ok (
    $test$
    delete from public.deposit_types
    where id = 'a4000000-0000-0000-0000-000000000011'
  $test$,
    'world admin can delete deposit_types in the administered world'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: can read and manage deposit_types across all worlds
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
        public.deposit_types
      where
        world_id in (
          'a2000000-0000-0000-0000-000000000001',
          'a2000000-0000-0000-0000-000000000002',
          'a2000000-0000-0000-0000-000000000003'
        )
    ),
    2,
    'super admin can read deposit_types across all worlds'
  );

select
  lives_ok (
    $test$
    insert into public.deposit_types (id, world_id, name, slug, job_id, output_units_per_worker)
    values (
      'a4000000-0000-0000-0000-000000000012',
      'a2000000-0000-0000-0000-000000000003',
      'Super Admin Deposit',
      'super-admin-deposit',
      'a3000000-0000-0000-0000-000000000012',
      7
    )
  $test$,
    'super admin can insert deposit_types in any world'
  );

select
  lives_ok (
    $test$
    update public.deposit_types
    set name = 'Super Admin Updated'
    where id = 'a4000000-0000-0000-0000-000000000012'
  $test$,
    'super admin can update deposit_types in any world'
  );

select
  lives_ok (
    $test$
    delete from public.deposit_types
    where id = 'a4000000-0000-0000-0000-000000000012'
  $test$,
    'super admin can delete deposit_types in any world'
  );

reset role;

-- ===========================================================================
-- CONSTRAINTS: run without a role so postgres bypasses RLS
-- ===========================================================================
-- Seed a deposit type for the unique-job_id constraint test.
insert into
  public.deposit_types (
    world_id,
    name,
    slug,
    job_id,
    output_units_per_worker
  )
values
  (
    'a2000000-0000-0000-0000-000000000001',
    'Constraint Deposit',
    'constraint-deposit',
    'a3000000-0000-0000-0000-000000000020',
    10
  );

-- Duplicate job_id must be rejected.
select
  throws_ok (
    $test$
    insert into public.deposit_types (world_id, name, slug, job_id, output_units_per_worker)
    values (
      'a2000000-0000-0000-0000-000000000001',
      'Duplicate Job Deposit',
      'duplicate-job-deposit',
      'a3000000-0000-0000-0000-000000000020',
      5
    )
  $test$,
    '23505',
    null,
    'duplicate job_id rejected by unique constraint'
  );

-- output_units_per_worker = 0 must be rejected (check requires > 0).
select
  throws_ok (
    $test$
    insert into public.deposit_types (world_id, name, slug, job_id, output_units_per_worker)
    values (
      'a2000000-0000-0000-0000-000000000001',
      'Zero Units Deposit',
      'zero-units-deposit',
      'a3000000-0000-0000-0000-000000000021',
      0
    )
  $test$,
    '23514',
    null,
    'output_units_per_worker = 0 rejected by check constraint'
  );

select
  *
from
  finish ();

rollback;
