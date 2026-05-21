-- pgTAP tests for public.nations RLS.
-- Run with: npx supabase test db
begin;

select
  plan (21);

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
    '61000000-0000-0000-0000-000000000001',
    'nations-owner@example.com',
    'x',
    now(),
    '{"username":"nations_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    '61000000-0000-0000-0000-000000000002',
    'nations-admin@example.com',
    'x',
    now(),
    '{"username":"nations_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '61000000-0000-0000-0000-000000000003',
    'nations-outsider@example.com',
    'x',
    now(),
    '{"username":"nations_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    '61000000-0000-0000-0000-000000000004',
    'nations-superadmin@example.com',
    'x',
    now(),
    '{"username":"nations_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = '61000000-0000-0000-0000-000000000004';

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    '62000000-0000-0000-0000-000000000001',
    'Nations Private World',
    '61000000-0000-0000-0000-000000000001',
    'private',
    'active'
  ),
  (
    '62000000-0000-0000-0000-000000000002',
    'Nations Public World',
    '61000000-0000-0000-0000-000000000001',
    'public',
    'active'
  ),
  (
    '62000000-0000-0000-0000-000000000003',
    'Nations Outsider World',
    '61000000-0000-0000-0000-000000000003',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    '62000000-0000-0000-0000-000000000001',
    '61000000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name, description, is_hidden)
values
  (
    '63000000-0000-0000-0000-000000000001',
    '62000000-0000-0000-0000-000000000001',
    'Private Nation',
    'Private world nation',
    false
  ),
  (
    '63000000-0000-0000-0000-000000000002',
    '62000000-0000-0000-0000-000000000002',
    'Public Nation',
    null,
    false
  ),
  (
    '63000000-0000-0000-0000-000000000003',
    '62000000-0000-0000-0000-000000000003',
    'Outsider Nation',
    null,
    true
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
        public.nations
    ),
    0,
    'anon cannot read nations'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: can read public-world nations, not inaccessible private-world
-- nations, and cannot manage nations outside an administered world.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"61000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.nations
      where
        id = '63000000-0000-0000-0000-000000000002'
    ),
    'outsider can read public-world nations'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.nations
      where
        id = '63000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read inaccessible private-world nations'
  );

select
  throws_ok (
    $test$
    insert into public.nations (world_id, name)
    values ('62000000-0000-0000-0000-000000000001', 'Outsider Insert')
  $test$,
    '42501',
    null,
    'outsider cannot insert nations into inaccessible worlds'
  );

update public.nations
set
  name = 'Outsider Update'
where
  id = '63000000-0000-0000-0000-000000000001';

reset role;

select
  is (
    (
      select
        name
      from
        public.nations
      where
        id = '63000000-0000-0000-0000-000000000001'
    ),
    'Private Nation',
    'outsider cannot update nations outside administered worlds'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"61000000-0000-0000-0000-000000000003","role":"authenticated"}';

delete from public.nations
where
  id = '63000000-0000-0000-0000-000000000001';

reset role;

select
  ok (
    exists (
      select
        1
      from
        public.nations
      where
        id = '63000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot delete nations outside administered worlds'
  );

-- ===========================================================================
-- OWNER: world owners can manage nations.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.nations
      where
        id = '63000000-0000-0000-0000-000000000001'
    ),
    'owner can read nations in their world'
  );

select
  lives_ok (
    $test$
    insert into public.nations (id, world_id, name)
    values (
      '63000000-0000-0000-0000-000000000004',
      '62000000-0000-0000-0000-000000000001',
      'Owner Insert'
    )
  $test$,
    'owner can insert nations in their world'
  );

select
  lives_ok (
    $test$
    update public.nations
    set description = 'Owner update'
    where id = '63000000-0000-0000-0000-000000000004'
  $test$,
    'owner can update nations in their world'
  );

select
  lives_ok (
    $test$
    delete from public.nations
    where id = '63000000-0000-0000-0000-000000000004'
  $test$,
    'owner can delete nations in their world'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: explicit world admins can manage nations.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"61000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.nations
      where
        id = '63000000-0000-0000-0000-000000000001'
    ),
    'world admin can read nations in administered world'
  );

select
  lives_ok (
    $test$
    insert into public.nations (id, world_id, name, is_hidden)
    values (
      '63000000-0000-0000-0000-000000000005',
      '62000000-0000-0000-0000-000000000001',
      'Admin Insert',
      true
    )
  $test$,
    'world admin can insert nations in administered world'
  );

select
  lives_ok (
    $test$
    update public.nations
    set name = 'Admin Update'
    where id = '63000000-0000-0000-0000-000000000005'
  $test$,
    'world admin can update nations in administered world'
  );

select
  lives_ok (
    $test$
    delete from public.nations
    where id = '63000000-0000-0000-0000-000000000005'
  $test$,
    'world admin can delete nations in administered world'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: can read and manage nations across worlds.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"61000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.nations
      where
        id in (
          '63000000-0000-0000-0000-000000000001',
          '63000000-0000-0000-0000-000000000002',
          '63000000-0000-0000-0000-000000000003'
        )
    ),
    3,
    'super admin can read nations across worlds'
  );

select
  lives_ok (
    $test$
    insert into public.nations (id, world_id, name)
    values (
      '63000000-0000-0000-0000-000000000006',
      '62000000-0000-0000-0000-000000000003',
      'Super Admin Insert'
    )
  $test$,
    'super admin can insert nations in any world'
  );

select
  lives_ok (
    $test$
    update public.nations
    set description = 'Super admin update'
    where id = '63000000-0000-0000-0000-000000000006'
  $test$,
    'super admin can update nations in any world'
  );

select
  lives_ok (
    $test$
    delete from public.nations
    where id = '63000000-0000-0000-0000-000000000006'
  $test$,
    'super admin can delete nations in any world'
  );

reset role;

-- ===========================================================================
-- DEFAULTS AND CONSTRAINTS
-- ===========================================================================
select
  lives_ok (
    $test$
    insert into public.nations (id, world_id, name)
    values (
      '63000000-0000-0000-0000-000000000007',
      '62000000-0000-0000-0000-000000000001',
      'Default Hidden Flag'
    )
  $test$,
    'nations can be inserted without optional description or is_hidden'
  );

select
  is (
    (
      select
        is_hidden
      from
        public.nations
      where
        id = '63000000-0000-0000-0000-000000000007'
    ),
    false,
    'is_hidden defaults to false'
  );

select
  throws_ok (
    $test$
    insert into public.nations (world_id, name)
    values ('62000000-0000-0000-0000-000000000001', '')
  $test$,
    '23514',
    null,
    'nations require a non-empty name'
  );

rollback;
