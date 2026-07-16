-- pgTAP tests for public.education_levels RLS, rank uniqueness, and the
-- reorder_education_level RPC.
-- Run with: npx supabase test db
begin;

select
  plan (29);

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
    'c1000000-0000-0000-0000-000000000001',
    'edu-owner@example.com',
    'x',
    now(),
    '{"username":"edu_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    'edu-admin@example.com',
    'x',
    now(),
    '{"username":"edu_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000003',
    'edu-outsider@example.com',
    'x',
    now(),
    '{"username":"edu_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000004',
    'edu-superadmin@example.com',
    'x',
    now(),
    '{"username":"edu_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'c1000000-0000-0000-0000-000000000004';

insert into
  public.worlds (id, name, status)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'Edu Private World',
    'active'
  ),
  (
    'c2000000-0000-0000-0000-000000000002',
    'Edu Public World',
    'active'
  ),
  (
    'c2000000-0000-0000-0000-000000000003',
    'Edu Outsider World',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001'
  ),
  (
    'c2000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000002'
  );

insert into
  public.education_levels (id, world_id, name, description, rank)
values
  (
    'c3000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000001',
    'Illiterate',
    'Cannot read or write.',
    1
  ),
  (
    'c3000000-0000-0000-0000-000000000002',
    'c2000000-0000-0000-0000-000000000001',
    'Basic',
    null,
    2
  ),
  (
    'c3000000-0000-0000-0000-000000000005',
    'c2000000-0000-0000-0000-000000000002',
    'Scholar',
    null,
    1
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
        public.education_levels
    ),
    0,
    'anon cannot read education levels'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: can read public-world levels; cannot read private; cannot write
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.education_levels
      where
        world_id = 'c2000000-0000-0000-0000-000000000002'
    ),
    'outsider cannot read education levels without admin/pc access'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.education_levels
      where
        world_id = 'c2000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read education levels in an inaccessible private world'
  );

select
  throws_ok (
    $test$
    insert into public.education_levels (world_id, name, rank)
    values ('c2000000-0000-0000-0000-000000000001', 'Outsider Insert', 3)
  $test$,
    '42501',
    null,
    'outsider cannot insert education levels into an inaccessible world'
  );

update public.education_levels
set
  name = 'Outsider Update'
where
  id = 'c3000000-0000-0000-0000-000000000001';

reset role;

select
  is (
    (
      select
        name
      from
        public.education_levels
      where
        id = 'c3000000-0000-0000-0000-000000000001'
    ),
    'Illiterate',
    'outsider update is silently ignored by RLS'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}';

delete from public.education_levels
where
  id = 'c3000000-0000-0000-0000-000000000001';

reset role;

select
  ok (
    exists (
      select
        1
      from
        public.education_levels
      where
        id = 'c3000000-0000-0000-0000-000000000001'
    ),
    'outsider delete is silently ignored by RLS'
  );

-- ===========================================================================
-- WORLD ADMIN: explicit world admins can manage education levels
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.education_levels (id, world_id, name)
    values (
      'c3000000-0000-0000-0000-000000000003',
      'c2000000-0000-0000-0000-000000000001',
      'Skilled'
    )
  $test$,
    'world admin can insert an education level in the administered world (rank auto-assigned)'
  );

select
  is (
    (
      select
        rank
      from
        public.education_levels
      where
        id = 'c3000000-0000-0000-0000-000000000003'
    ),
    3,
    'inserted level without an explicit rank is appended to the end of the ladder'
  );

select
  lives_ok (
    $test$
    update public.education_levels
    set name = 'Admin Update'
    where id = 'c3000000-0000-0000-0000-000000000003'
  $test$,
    'world admin can update education levels in the administered world'
  );

select
  throws_ok (
    $test$
    insert into public.education_levels (world_id, name)
    values ('c2000000-0000-0000-0000-000000000001', 'Admin Update')
  $test$,
    '23505',
    null,
    'duplicate education level name within a world is rejected'
  );

select
  throws_ok (
    $test$
    insert into public.education_levels (world_id, name, rank)
    values ('c2000000-0000-0000-0000-000000000001', 'Duplicate Rank', 2)
  $test$,
    '23505',
    null,
    'duplicate rank within a world is rejected'
  );

select
  lives_ok (
    $test$
    select public.create_education_level(
      'c2000000-0000-0000-0000-000000000001', 'Scholar (Admin RPC)', null
    )
  $test$,
    'world admin can create an education level via the create_education_level RPC'
  );

select
  is (
    (
      select
        rank
      from
        public.education_levels
      where
        world_id = 'c2000000-0000-0000-0000-000000000001'
        and name = 'Scholar (Admin RPC)'
    ),
    4,
    'the RPC-created level is appended to the end of the ladder'
  );

-- reorder_education_level: swap "Basic" (rank 2) up with "Illiterate" (rank 1)
select
  lives_ok (
    $test$
    select public.reorder_education_level(
      'c3000000-0000-0000-0000-000000000002', 'up'
    )
  $test$,
    'world admin can reorder an education level via the RPC'
  );

select
  is (
    (
      select
        rank
      from
        public.education_levels
      where
        id = 'c3000000-0000-0000-0000-000000000002'
    ),
    1,
    'moving a level up swaps it into the lower rank'
  );

select
  is (
    (
      select
        rank
      from
        public.education_levels
      where
        id = 'c3000000-0000-0000-0000-000000000001'
    ),
    2,
    'the displaced neighbor takes the vacated rank'
  );

select
  throws_ok (
    $test$
    select public.reorder_education_level(
      'c3000000-0000-0000-0000-000000000002', 'up'
    )
  $test$,
    'P0001',
    null,
    'reordering the first level further up fails with no adjacent level'
  );

select
  lives_ok (
    $test$
    delete from public.education_levels
    where id = 'c3000000-0000-0000-0000-000000000003'
  $test$,
    'world admin can delete education levels in the administered world'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: can read and manage education levels across all worlds
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.education_levels
      where
        world_id in (
          'c2000000-0000-0000-0000-000000000001',
          'c2000000-0000-0000-0000-000000000002',
          'c2000000-0000-0000-0000-000000000003'
        )
    ),
    4,
    'super admin can read education levels across all worlds'
  );

select
  lives_ok (
    $test$
    insert into public.education_levels (id, world_id, name)
    values (
      'c3000000-0000-0000-0000-000000000004',
      'c2000000-0000-0000-0000-000000000003',
      'Super Admin Insert'
    )
  $test$,
    'super admin can insert education levels in any world'
  );

select
  lives_ok (
    $test$
    update public.education_levels
    set name = 'Super Admin Update'
    where id = 'c3000000-0000-0000-0000-000000000004'
  $test$,
    'super admin can update education levels in any world'
  );

select
  lives_ok (
    $test$
    delete from public.education_levels
    where id = 'c3000000-0000-0000-0000-000000000004'
  $test$,
    'super admin can delete education levels in any world'
  );

reset role;

select
  throws_ok (
    $test$
    insert into public.education_levels (world_id, name, description)
    values (
      'c2000000-0000-0000-0000-000000000001',
      'Too Long Description',
      repeat('x', 1001)
    )
  $test$,
    '23514',
    null,
    'an overlong description is rejected'
  );

-- ===========================================================================
-- natural_born_percent: range check + per-world sum trigger
-- (world c2000000-0000-0000-0000-000000000003 has no fixture levels)
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.education_levels (world_id, name, natural_born_percent)
    values (
      'c2000000-0000-0000-0000-000000000003',
      'Percent Too High',
      101
    )
  $test$,
    'P0001',
    null,
    -- A single value above 100 always also fails the per-world sum trigger
    -- (0 existing + 101 > 100), and the trigger's BEFORE ROW check runs
    -- before the range CHECK constraint gets a chance to fire, so this
    -- surfaces as P0001 rather than the range constraint's 23514.
    'a natural_born_percent above 100 is rejected'
  );

select
  throws_ok (
    $test$
    insert into public.education_levels (world_id, name, natural_born_percent)
    values (
      'c2000000-0000-0000-0000-000000000003',
      'Percent Negative',
      -1
    )
  $test$,
    '23514',
    null,
    'a negative natural_born_percent is rejected'
  );

select
  lives_ok (
    $test$
    insert into public.education_levels (id, world_id, name, natural_born_percent)
    values (
      'c3000000-0000-0000-0000-000000000007',
      'c2000000-0000-0000-0000-000000000003',
      'Percent A',
      60
    )
  $test$,
    'a natural_born_percent within the world total is accepted'
  );

select
  throws_ok (
    $test$
    insert into public.education_levels (world_id, name, natural_born_percent)
    values (
      'c2000000-0000-0000-0000-000000000003',
      'Percent B Over',
      41
    )
  $test$,
    'P0001',
    null,
    'inserting a level that pushes the world total over 100 is rejected'
  );

select
  lives_ok (
    $test$
    insert into public.education_levels (id, world_id, name, natural_born_percent)
    values (
      'c3000000-0000-0000-0000-000000000008',
      'c2000000-0000-0000-0000-000000000003',
      'Percent B At Limit',
      40
    )
  $test$,
    'inserting a level that brings the world total to exactly 100 is accepted'
  );

select
  throws_ok (
    $test$
    update public.education_levels
    set natural_born_percent = 41
    where id = 'c3000000-0000-0000-0000-000000000008'
  $test$,
    'P0001',
    null,
    'updating a level to push the world total over 100 is rejected'
  );

select
  *
from
  finish ();

rollback;
