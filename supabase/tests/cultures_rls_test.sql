-- pgTAP tests for public.cultures RLS and duplicate-name rejection.
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
    'b1000000-0000-0000-0000-000000000001',
    'cul-owner@example.com',
    'x',
    now(),
    '{"username":"cul_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1000000-0000-0000-0000-000000000002',
    'cul-admin@example.com',
    'x',
    now(),
    '{"username":"cul_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1000000-0000-0000-0000-000000000003',
    'cul-outsider@example.com',
    'x',
    now(),
    '{"username":"cul_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1000000-0000-0000-0000-000000000004',
    'cul-superadmin@example.com',
    'x',
    now(),
    '{"username":"cul_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'b1000000-0000-0000-0000-000000000004';

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'b2000000-0000-0000-0000-000000000001',
    'Cul Private World',
    'private',
    'active'
  ),
  (
    'b2000000-0000-0000-0000-000000000002',
    'Cul Public World',
    'public',
    'active'
  ),
  (
    'b2000000-0000-0000-0000-000000000003',
    'Cul Outsider World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'b2000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001'
  ),
  (
    'b2000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000002'
  );

insert into
  public.cultures (id, world_id, name, description, color)
values
  (
    'b3000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'Highlander',
    'Mountain-dwelling culture.',
    '#336699'
  ),
  (
    'b3000000-0000-0000-0000-000000000002',
    'b2000000-0000-0000-0000-000000000002',
    'Seafarer',
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
        public.cultures
    ),
    0,
    'anon cannot read cultures'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: can read public-world cultures; cannot read private; cannot write
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.cultures
      where
        world_id = 'b2000000-0000-0000-0000-000000000002'
    ),
    'outsider can read cultures in a public world'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.cultures
      where
        world_id = 'b2000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read cultures in an inaccessible private world'
  );

select
  throws_ok (
    $test$
    insert into public.cultures (world_id, name)
    values ('b2000000-0000-0000-0000-000000000001', 'Outsider Insert')
  $test$,
    '42501',
    null,
    'outsider cannot insert cultures into an inaccessible world'
  );

update public.cultures
set
  name = 'Outsider Update'
where
  id = 'b3000000-0000-0000-0000-000000000001';

reset role;

select
  is (
    (
      select
        name
      from
        public.cultures
      where
        id = 'b3000000-0000-0000-0000-000000000001'
    ),
    'Highlander',
    'outsider update is silently ignored by RLS'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000003","role":"authenticated"}';

delete from public.cultures
where
  id = 'b3000000-0000-0000-0000-000000000001';

reset role;

select
  ok (
    exists (
      select
        1
      from
        public.cultures
      where
        id = 'b3000000-0000-0000-0000-000000000001'
    ),
    'outsider delete is silently ignored by RLS'
  );

-- ===========================================================================
-- WORLD ADMIN: explicit world admins can manage cultures
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.cultures (id, world_id, name)
    values (
      'b3000000-0000-0000-0000-000000000003',
      'b2000000-0000-0000-0000-000000000001',
      'Admin Insert'
    )
  $test$,
    'world admin can insert cultures in the administered world'
  );

select
  lives_ok (
    $test$
    update public.cultures
    set name = 'Admin Update'
    where id = 'b3000000-0000-0000-0000-000000000003'
  $test$,
    'world admin can update cultures in the administered world'
  );

select
  throws_ok (
    $test$
    insert into public.cultures (world_id, name)
    values ('b2000000-0000-0000-0000-000000000001', 'Admin Update')
  $test$,
    '23505',
    null,
    'duplicate culture name within a world is rejected'
  );

select
  lives_ok (
    $test$
    delete from public.cultures
    where id = 'b3000000-0000-0000-0000-000000000003'
  $test$,
    'world admin can delete cultures in the administered world'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: can read and manage cultures across all worlds
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.cultures
      where
        world_id in (
          'b2000000-0000-0000-0000-000000000001',
          'b2000000-0000-0000-0000-000000000002',
          'b2000000-0000-0000-0000-000000000003'
        )
    ),
    2,
    'super admin can read cultures across all worlds'
  );

select
  lives_ok (
    $test$
    insert into public.cultures (id, world_id, name)
    values (
      'b3000000-0000-0000-0000-000000000004',
      'b2000000-0000-0000-0000-000000000003',
      'Super Admin Insert'
    )
  $test$,
    'super admin can insert cultures in any world'
  );

select
  lives_ok (
    $test$
    update public.cultures
    set name = 'Super Admin Update'
    where id = 'b3000000-0000-0000-0000-000000000004'
  $test$,
    'super admin can update cultures in any world'
  );

select
  lives_ok (
    $test$
    delete from public.cultures
    where id = 'b3000000-0000-0000-0000-000000000004'
  $test$,
    'super admin can delete cultures in any world'
  );

reset role;

select
  throws_ok (
    $test$
    insert into public.cultures (world_id, name, color)
    values ('b2000000-0000-0000-0000-000000000001', 'Bad Color', 'not-a-color')
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
