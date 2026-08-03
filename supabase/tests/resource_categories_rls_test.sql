-- pgTAP tests for public.resource_categories RLS, duplicate-name rejection,
-- and that deleting a category clears (not deletes) referencing resources.
-- Run with: npx supabase test db
begin;

select
  plan (17);

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
    'rc-owner@example.com',
    'x',
    now(),
    '{"username":"rc_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    'rc-admin@example.com',
    'x',
    now(),
    '{"username":"rc_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000003',
    'rc-outsider@example.com',
    'x',
    now(),
    '{"username":"rc_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000004',
    'rc-superadmin@example.com',
    'x',
    now(),
    '{"username":"rc_superadmin"}'::jsonb,
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
    'RC Private World',
    'active'
  ),
  (
    'c2000000-0000-0000-0000-000000000002',
    'RC Public World',
    'active'
  ),
  (
    'c2000000-0000-0000-0000-000000000003',
    'RC Outsider World',
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
  public.resource_categories (id, world_id, name, color, sort_order)
values
  (
    'c3000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000001',
    'Raw Materials',
    '#336699',
    0
  ),
  (
    'c3000000-0000-0000-0000-000000000002',
    'c2000000-0000-0000-0000-000000000002',
    'Food',
    '#6b7280',
    0
  );

insert into
  public.resources (id, world_id, name, slug, category_id)
values
  (
    'c4000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000001',
    'Iron Ore',
    'iron-ore',
    'c3000000-0000-0000-0000-000000000001'
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
        public.resource_categories
    ),
    0,
    'anon cannot read resource categories'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: can read public-world categories; cannot read private; cannot write
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
        public.resource_categories
      where
        world_id = 'c2000000-0000-0000-0000-000000000002'
    ),
    'outsider cannot read resource categories without admin/pc access'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.resource_categories
      where
        world_id = 'c2000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read resource categories in an inaccessible private world'
  );

select
  throws_ok (
    $test$
    insert into public.resource_categories (world_id, name)
    values ('c2000000-0000-0000-0000-000000000001', 'Outsider Insert')
  $test$,
    '42501',
    null,
    'outsider cannot insert resource categories into an inaccessible world'
  );

update public.resource_categories
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
        public.resource_categories
      where
        id = 'c3000000-0000-0000-0000-000000000001'
    ),
    'Raw Materials',
    'outsider update is silently ignored by RLS'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}';

delete from public.resource_categories
where
  id = 'c3000000-0000-0000-0000-000000000001';

reset role;

select
  ok (
    exists (
      select
        1
      from
        public.resource_categories
      where
        id = 'c3000000-0000-0000-0000-000000000001'
    ),
    'outsider delete is silently ignored by RLS'
  );

-- ===========================================================================
-- WORLD ADMIN: explicit world admins can manage resource categories
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.resource_categories (id, world_id, name)
    values (
      'c3000000-0000-0000-0000-000000000003',
      'c2000000-0000-0000-0000-000000000001',
      'Admin Insert'
    )
  $test$,
    'world admin can insert resource categories in the administered world'
  );

select
  lives_ok (
    $test$
    update public.resource_categories
    set name = 'Admin Update'
    where id = 'c3000000-0000-0000-0000-000000000003'
  $test$,
    'world admin can update resource categories in the administered world'
  );

select
  throws_ok (
    $test$
    insert into public.resource_categories (world_id, name)
    values ('c2000000-0000-0000-0000-000000000001', 'Admin Update')
  $test$,
    '23505',
    null,
    'duplicate resource category name within a world is rejected'
  );

select
  lives_ok (
    $test$
    delete from public.resource_categories
    where id = 'c3000000-0000-0000-0000-000000000003'
  $test$,
    'world admin can delete resource categories in the administered world'
  );

-- Deleting a category that resources still reference must clear the FK,
-- never delete the resource itself.
select
  lives_ok (
    $test$
    delete from public.resource_categories
    where id = 'c3000000-0000-0000-0000-000000000001'
  $test$,
    'world admin can delete a resource category that is still referenced'
  );

reset role;

select
  ok (
    exists (
      select
        1
      from
        public.resources
      where
        id = 'c4000000-0000-0000-0000-000000000001'
    ),
    'deleting a resource category does not delete the referencing resource'
  );

select
  is (
    (
      select
        category_id
      from
        public.resources
      where
        id = 'c4000000-0000-0000-0000-000000000001'
    ),
    null,
    'deleting a resource category clears category_id on referencing resources'
  );

-- ===========================================================================
-- SUPER ADMIN: can read and manage resource categories across all worlds
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.resource_categories (id, world_id, name)
    values (
      'c3000000-0000-0000-0000-000000000004',
      'c2000000-0000-0000-0000-000000000003',
      'Super Admin Insert'
    )
  $test$,
    'super admin can insert resource categories in any world'
  );

select
  lives_ok (
    $test$
    update public.resource_categories
    set name = 'Super Admin Update'
    where id = 'c3000000-0000-0000-0000-000000000004'
  $test$,
    'super admin can update resource categories in any world'
  );

select
  lives_ok (
    $test$
    delete from public.resource_categories
    where id = 'c3000000-0000-0000-0000-000000000004'
  $test$,
    'super admin can delete resource categories in any world'
  );

reset role;

select
  throws_ok (
    $test$
    insert into public.resource_categories (world_id, name, color)
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
