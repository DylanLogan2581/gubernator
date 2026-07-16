-- pgTAP tests for public.managed_population_types RLS and numeric column
-- constraints.
-- Job linkage / per-job constraints now live on
-- managed_population_husbandry_jobs / managed_population_culling_jobs — see
-- their dedicated RLS test files.
-- Run with: npx supabase test db
begin;

select
  plan (19);

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
    'e1000000-0000-0000-0000-000000000001',
    'mpt-owner@example.com',
    'x',
    now(),
    '{"username":"mpt_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'mpt-admin@example.com',
    'x',
    now(),
    '{"username":"mpt_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'mpt-outsider@example.com',
    'x',
    now(),
    '{"username":"mpt_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000004',
    'mpt-superadmin@example.com',
    'x',
    now(),
    '{"username":"mpt_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'e1000000-0000-0000-0000-000000000004';

insert into
  public.worlds (id, name, status)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'MPT Private World',
    'active'
  ),
  (
    'e2000000-0000-0000-0000-000000000002',
    'MPT Public World',
    'active'
  ),
  (
    'e2000000-0000-0000-0000-000000000003',
    'MPT Outsider World',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001'
  ),
  (
    'e2000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000002'
  );

-- Seed a population type in the private world for write tests.
insert into
  public.managed_population_types (id, world_id, name, slug, growth_rate)
values
  (
    'e4000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'Cattle',
    'cattle',
    0.05
  );

-- Seed a population type in the public world for outsider read tests.
insert into
  public.managed_population_types (id, world_id, name, slug, growth_rate)
values
  (
    'e4000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000002',
    'Sheep',
    'sheep',
    0.10
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
        public.managed_population_types
    ),
    0,
    'anon cannot read managed_population_types'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: can read public-world types; cannot read private; cannot write
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.managed_population_types
      where
        world_id = 'e2000000-0000-0000-0000-000000000002'
    ),
    'outsider cannot read managed_population_types without admin/pc access'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.managed_population_types
      where
        world_id = 'e2000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read managed_population_types in an inaccessible private world'
  );

select
  throws_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, growth_rate
    )
    values (
      'e2000000-0000-0000-0000-000000000001',
      'Outsider Herd', 'outsider-herd',
      0
    )
    $test$,
    '42501',
    null,
    'outsider cannot insert managed_population_types into an inaccessible world'
  );

update public.managed_population_types
set
  name = 'Outsider Update'
where
  id = 'e4000000-0000-0000-0000-000000000001';

delete from public.managed_population_types
where
  id = 'e4000000-0000-0000-0000-000000000001';

reset role;

select
  is (
    (
      select
        name
      from
        public.managed_population_types
      where
        id = 'e4000000-0000-0000-0000-000000000001'
    ),
    'Cattle',
    'outsider update is silently ignored by RLS'
  );

select
  ok (
    exists (
      select
        1
      from
        public.managed_population_types
      where
        id = 'e4000000-0000-0000-0000-000000000001'
    ),
    'outsider delete is silently ignored by RLS'
  );

-- ===========================================================================
-- OWNER: world owners can manage managed_population_types in their world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.managed_population_types
      where
        world_id = 'e2000000-0000-0000-0000-000000000001'
    ),
    'owner can read managed_population_types in their world'
  );

select
  lives_ok (
    $test$
    insert into public.managed_population_types (
      id, world_id, name, slug, growth_rate
    )
    values (
      'e4000000-0000-0000-0000-000000000010',
      'e2000000-0000-0000-0000-000000000001',
      'Owner Herd', 'owner-herd',
      0.02
    )
    $test$,
    'owner can insert managed_population_types in their world'
  );

select
  lives_ok (
    $test$
    update public.managed_population_types
    set name = 'Owner Updated'
    where id = 'e4000000-0000-0000-0000-000000000010'
    $test$,
    'owner can update managed_population_types in their world'
  );

select
  lives_ok (
    $test$
    delete from public.managed_population_types
    where id = 'e4000000-0000-0000-0000-000000000010'
    $test$,
    'owner can delete managed_population_types in their world'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: explicit admins can manage managed_population_types
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.managed_population_types
      where
        world_id = 'e2000000-0000-0000-0000-000000000001'
    ),
    'world admin can read managed_population_types in the administered world'
  );

select
  lives_ok (
    $test$
    insert into public.managed_population_types (
      id, world_id, name, slug, growth_rate
    )
    values (
      'e4000000-0000-0000-0000-000000000011',
      'e2000000-0000-0000-0000-000000000001',
      'Admin Herd', 'admin-herd',
      0.03
    )
    $test$,
    'world admin can insert managed_population_types in the administered world'
  );

select
  lives_ok (
    $test$
    update public.managed_population_types
    set name = 'Admin Updated'
    where id = 'e4000000-0000-0000-0000-000000000011'
    $test$,
    'world admin can update managed_population_types in the administered world'
  );

select
  lives_ok (
    $test$
    delete from public.managed_population_types
    where id = 'e4000000-0000-0000-0000-000000000011'
    $test$,
    'world admin can delete managed_population_types in the administered world'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: can read and manage managed_population_types across all worlds
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.managed_population_types
      where
        world_id in (
          'e2000000-0000-0000-0000-000000000001',
          'e2000000-0000-0000-0000-000000000002',
          'e2000000-0000-0000-0000-000000000003'
        )
    ),
    2,
    'super admin can read managed_population_types across all worlds'
  );

select
  lives_ok (
    $test$
    insert into public.managed_population_types (
      id, world_id, name, slug, growth_rate
    )
    values (
      'e4000000-0000-0000-0000-000000000012',
      'e2000000-0000-0000-0000-000000000003',
      'Super Herd', 'super-herd',
      0.08
    )
    $test$,
    'super admin can insert managed_population_types in any world'
  );

select
  lives_ok (
    $test$
    update public.managed_population_types
    set name = 'Super Updated'
    where id = 'e4000000-0000-0000-0000-000000000012'
    $test$,
    'super admin can update managed_population_types in any world'
  );

select
  lives_ok (
    $test$
    delete from public.managed_population_types
    where id = 'e4000000-0000-0000-0000-000000000012'
    $test$,
    'super admin can delete managed_population_types in any world'
  );

reset role;

-- ===========================================================================
-- CONSTRAINTS: run without a role so postgres bypasses RLS
-- ===========================================================================
-- negative growth_rate must be rejected.
select
  throws_ok (
    $test$
    insert into public.managed_population_types (
      world_id, name, slug, growth_rate
    )
    values (
      'e2000000-0000-0000-0000-000000000001',
      'Negative Growth Herd', 'negative-growth-herd',
      -0.01
    )
    $test$,
    '23514',
    null,
    'negative growth_rate rejected by check constraint'
  );

select
  *
from
  finish ();

rollback;
