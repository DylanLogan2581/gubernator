-- pgTAP tests for public.deposit_types RLS.
-- Job linkage / per-job constraints now live on deposit_type_jobs — see
-- deposit_type_jobs_rls_test.sql and
-- deposit_type_jobs_worker_inputs_validation_test.sql.
-- Run with: npx supabase test db
begin;

select
  plan (18);

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
  public.worlds (id, name, status)
values
  (
    'a2000000-0000-0000-0000-000000000001',
    'DT Private World',
    'active'
  ),
  (
    'a2000000-0000-0000-0000-000000000002',
    'DT Public World',
    'active'
  ),
  (
    'a2000000-0000-0000-0000-000000000003',
    'DT Outsider World',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'a2000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000001'
  ),
  (
    'a2000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000002'
  );

-- Seed a deposit type in the private world for write tests.
insert into
  public.deposit_types (id, world_id, name, slug)
values
  (
    'a4000000-0000-0000-0000-000000000001',
    'a2000000-0000-0000-0000-000000000001',
    'Iron Deposit',
    'iron-deposit'
  );

-- Seed a deposit type in the public world for outsider read tests.
insert into
  public.deposit_types (id, world_id, name, slug)
values
  (
    'a4000000-0000-0000-0000-000000000002',
    'a2000000-0000-0000-0000-000000000002',
    'Stone Deposit',
    'stone-deposit'
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
    not exists (
      select
        1
      from
        public.deposit_types
      where
        world_id = 'a2000000-0000-0000-0000-000000000002'
    ),
    'outsider cannot read deposit_types without admin/pc access'
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
    insert into public.deposit_types (world_id, name, slug)
    values (
      'a2000000-0000-0000-0000-000000000001',
      'Outsider Deposit',
      'outsider-deposit'
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
    insert into public.deposit_types (id, world_id, name, slug)
    values (
      'a4000000-0000-0000-0000-000000000010',
      'a2000000-0000-0000-0000-000000000001',
      'Owner Deposit',
      'owner-deposit'
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
    insert into public.deposit_types (id, world_id, name, slug)
    values (
      'a4000000-0000-0000-0000-000000000011',
      'a2000000-0000-0000-0000-000000000001',
      'Admin Deposit',
      'admin-deposit'
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
    insert into public.deposit_types (id, world_id, name, slug)
    values (
      'a4000000-0000-0000-0000-000000000012',
      'a2000000-0000-0000-0000-000000000003',
      'Super Admin Deposit',
      'super-admin-deposit'
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

select
  *
from
  finish ();

rollback;
