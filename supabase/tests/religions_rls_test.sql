-- pgTAP tests for public.religions RLS and duplicate-name rejection.
-- Run with: npx supabase test db
begin;

select
  plan (15);

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
    'rel-owner@example.com',
    'x',
    now(),
    '{"username":"rel_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    'rel-admin@example.com',
    'x',
    now(),
    '{"username":"rel_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000003',
    'rel-outsider@example.com',
    'x',
    now(),
    '{"username":"rel_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000004',
    'rel-superadmin@example.com',
    'x',
    now(),
    '{"username":"rel_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'c1000000-0000-0000-0000-000000000004';

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'Rel Private World',
    'private',
    'active'
  ),
  (
    'c2000000-0000-0000-0000-000000000002',
    'Rel Public World',
    'public',
    'active'
  ),
  (
    'c2000000-0000-0000-0000-000000000003',
    'Rel Outsider World',
    'private',
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
  public.religions (id, world_id, name, description, color)
values
  (
    'c3000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000001',
    'Sunworship',
    'Fire-centered faith.',
    '#336699'
  ),
  (
    'c3000000-0000-0000-0000-000000000002',
    'c2000000-0000-0000-0000-000000000002',
    'Moonrite',
    null,
    '#6b7280'
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
        public.religions
    ),
    0,
    'anon cannot read religions'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: can read public-world religions; cannot read private; cannot write
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.religions
      where
        world_id = 'c2000000-0000-0000-0000-000000000002'
    ),
    'outsider can read religions in a public world'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.religions
      where
        world_id = 'c2000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read religions in an inaccessible private world'
  );

select
  throws_ok (
    $test$
    insert into public.religions (world_id, name)
    values ('c2000000-0000-0000-0000-000000000001', 'Outsider Insert')
  $test$,
    '42501',
    null,
    'outsider cannot insert religions into an inaccessible world'
  );

update public.religions
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
        public.religions
      where
        id = 'c3000000-0000-0000-0000-000000000001'
    ),
    'Sunworship',
    'outsider update is silently ignored by RLS'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}';

delete from public.religions
where
  id = 'c3000000-0000-0000-0000-000000000001';

reset role;

select
  ok (
    exists (
      select
        1
      from
        public.religions
      where
        id = 'c3000000-0000-0000-0000-000000000001'
    ),
    'outsider delete is silently ignored by RLS'
  );

-- ===========================================================================
-- WORLD ADMIN: explicit world admins can manage religions
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.religions (id, world_id, name)
    values (
      'c3000000-0000-0000-0000-000000000003',
      'c2000000-0000-0000-0000-000000000001',
      'Admin Insert'
    )
  $test$,
    'world admin can insert religions in the administered world'
  );

select
  lives_ok (
    $test$
    update public.religions
    set name = 'Admin Update'
    where id = 'c3000000-0000-0000-0000-000000000003'
  $test$,
    'world admin can update religions in the administered world'
  );

select
  throws_ok (
    $test$
    insert into public.religions (world_id, name)
    values ('c2000000-0000-0000-0000-000000000001', 'Admin Update')
  $test$,
    '23505',
    null,
    'duplicate religion name within a world is rejected'
  );

select
  lives_ok (
    $test$
    delete from public.religions
    where id = 'c3000000-0000-0000-0000-000000000003'
  $test$,
    'world admin can delete religions in the administered world'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: can read and manage religions across all worlds
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
        public.religions
      where
        world_id in (
          'c2000000-0000-0000-0000-000000000001',
          'c2000000-0000-0000-0000-000000000002',
          'c2000000-0000-0000-0000-000000000003'
        )
    ),
    2,
    'super admin can read religions across all worlds'
  );

select
  lives_ok (
    $test$
    insert into public.religions (id, world_id, name)
    values (
      'c3000000-0000-0000-0000-000000000004',
      'c2000000-0000-0000-0000-000000000003',
      'Super Admin Insert'
    )
  $test$,
    'super admin can insert religions in any world'
  );

select
  lives_ok (
    $test$
    update public.religions
    set name = 'Super Admin Update'
    where id = 'c3000000-0000-0000-0000-000000000004'
  $test$,
    'super admin can update religions in any world'
  );

select
  lives_ok (
    $test$
    delete from public.religions
    where id = 'c3000000-0000-0000-0000-000000000004'
  $test$,
    'super admin can delete religions in any world'
  );

reset role;

select
  throws_ok (
    $test$
    insert into public.religions (world_id, name, color)
    values ('c2000000-0000-0000-0000-000000000001', 'Bad Color', 'not-a-color')
  $test$,
    '23514',
    null,
    'non-hex color is rejected'
  );

select
  *
from
  finish ();

rollback;
