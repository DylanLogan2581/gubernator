-- pgTAP tests for public.resources RLS and system-resource protections.
-- Run with: npx supabase test db
begin;

select
  plan (26);

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
    'res-owner@example.com',
    'x',
    now(),
    '{"username":"res_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'res-admin@example.com',
    'x',
    now(),
    '{"username":"res_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'res-outsider@example.com',
    'x',
    now(),
    '{"username":"res_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'a1000000-0000-0000-0000-000000000004',
    'res-superadmin@example.com',
    'x',
    now(),
    '{"username":"res_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'a1000000-0000-0000-0000-000000000004';

-- Inserting worlds fires the seed trigger, so Food and Fresh Water are
-- created automatically for each world below.
insert into
  public.worlds (id, name, visibility, status)
values
  (
    'a2000000-0000-0000-0000-000000000001',
    'Res Private World',
    'private',
    'active'
  ),
  (
    'a2000000-0000-0000-0000-000000000002',
    'Res Public World',
    'public',
    'active'
  ),
  (
    'a2000000-0000-0000-0000-000000000003',
    'Res Outsider World',
    'private',
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

-- Insert a non-system resource in the private world for write tests.
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'a3000000-0000-0000-0000-000000000001',
    'a2000000-0000-0000-0000-000000000001',
    'Iron Ore',
    'iron-ore'
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
        public.resources
    ),
    0,
    'anon cannot read resources'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: can read public-world resources; cannot read private; cannot write
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
        public.resources
      where
        world_id = 'a2000000-0000-0000-0000-000000000002'
    ),
    'outsider can read resources in a public world'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.resources
      where
        world_id = 'a2000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read resources in an inaccessible private world'
  );

select
  throws_ok (
    $test$
    insert into public.resources (world_id, name, slug)
    values ('a2000000-0000-0000-0000-000000000001', 'Outsider Insert', 'outsider-insert')
  $test$,
    '42501',
    null,
    'outsider cannot insert resources into an inaccessible world'
  );

update public.resources
set
  name = 'Outsider Update'
where
  id = 'a3000000-0000-0000-0000-000000000001';

reset role;

select
  is (
    (
      select
        name
      from
        public.resources
      where
        id = 'a3000000-0000-0000-0000-000000000001'
    ),
    'Iron Ore',
    'outsider update is silently ignored by RLS'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a1000000-0000-0000-0000-000000000003","role":"authenticated"}';

delete from public.resources
where
  id = 'a3000000-0000-0000-0000-000000000001';

reset role;

select
  ok (
    exists (
      select
        1
      from
        public.resources
      where
        id = 'a3000000-0000-0000-0000-000000000001'
    ),
    'outsider delete is silently ignored by RLS'
  );

-- ===========================================================================
-- OWNER: world owners can manage non-system resources
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
        public.resources
      where
        world_id = 'a2000000-0000-0000-0000-000000000001'
    ),
    'owner can read resources in their world'
  );

select
  lives_ok (
    $test$
    insert into public.resources (id, world_id, name, slug)
    values (
      'a3000000-0000-0000-0000-000000000002',
      'a2000000-0000-0000-0000-000000000001',
      'Owner Insert',
      'owner-insert'
    )
  $test$,
    'owner can insert resources in their world'
  );

select
  lives_ok (
    $test$
    update public.resources
    set name = 'Owner Update'
    where id = 'a3000000-0000-0000-0000-000000000002'
  $test$,
    'owner can update resources in their world'
  );

select
  lives_ok (
    $test$
    delete from public.resources
    where id = 'a3000000-0000-0000-0000-000000000002'
  $test$,
    'owner can delete non-system resources in their world'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: explicit world admins can manage non-system resources
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
        public.resources
      where
        world_id = 'a2000000-0000-0000-0000-000000000001'
    ),
    'world admin can read resources in the administered world'
  );

select
  lives_ok (
    $test$
    insert into public.resources (id, world_id, name, slug)
    values (
      'a3000000-0000-0000-0000-000000000003',
      'a2000000-0000-0000-0000-000000000001',
      'Admin Insert',
      'admin-insert'
    )
  $test$,
    'world admin can insert resources in the administered world'
  );

select
  lives_ok (
    $test$
    update public.resources
    set name = 'Admin Update'
    where id = 'a3000000-0000-0000-0000-000000000003'
  $test$,
    'world admin can update resources in the administered world'
  );

select
  lives_ok (
    $test$
    delete from public.resources
    where id = 'a3000000-0000-0000-0000-000000000003'
  $test$,
    'world admin can delete non-system resources in the administered world'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: can read and manage resources across all worlds
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
        public.resources
      where
        world_id in (
          'a2000000-0000-0000-0000-000000000001',
          'a2000000-0000-0000-0000-000000000002',
          'a2000000-0000-0000-0000-000000000003'
        )
        and is_system_resource = true
    ),
    6,
    'super admin can read system resources across all worlds'
  );

select
  lives_ok (
    $test$
    insert into public.resources (id, world_id, name, slug)
    values (
      'a3000000-0000-0000-0000-000000000004',
      'a2000000-0000-0000-0000-000000000003',
      'Super Admin Insert',
      'super-admin-insert'
    )
  $test$,
    'super admin can insert resources in any world'
  );

select
  lives_ok (
    $test$
    update public.resources
    set name = 'Super Admin Update'
    where id = 'a3000000-0000-0000-0000-000000000004'
  $test$,
    'super admin can update resources in any world'
  );

select
  lives_ok (
    $test$
    delete from public.resources
    where id = 'a3000000-0000-0000-0000-000000000004'
  $test$,
    'super admin can delete non-system resources in any world'
  );

reset role;

-- ===========================================================================
-- SYSTEM RESOURCE PROTECTIONS
-- ===========================================================================
select
  throws_ok (
    $test$
    update public.resources
    set is_system_resource = false
    where world_id = 'a2000000-0000-0000-0000-000000000001'
      and slug = 'food'
  $test$,
    '23001',
    null,
    'is_system_resource cannot be changed from true to false'
  );

select
  throws_ok (
    $test$
    delete from public.resources
    where world_id = 'a2000000-0000-0000-0000-000000000001'
      and slug = 'food'
  $test$,
    '23001',
    null,
    'system resources cannot be deleted'
  );

-- ===========================================================================
-- SEED TRIGGER: new world insert seeds Food and Fresh Water
-- ===========================================================================
insert into
  public.worlds (id, name, visibility, status)
values
  (
    'a2000000-0000-0000-0000-000000000099',
    'Res Trigger Test World',
    'private',
    'active'
  );

select
  ok (
    exists (
      select
        1
      from
        public.resources
      where
        world_id = 'a2000000-0000-0000-0000-000000000099'
        and slug = 'food'
        and is_system_resource = true
    ),
    'seed trigger inserts Food system resource on new world insert'
  );

select
  ok (
    exists (
      select
        1
      from
        public.resources
      where
        world_id = 'a2000000-0000-0000-0000-000000000099'
        and slug = 'fresh-water'
        and is_system_resource = true
    ),
    'seed trigger inserts Fresh Water system resource on new world insert'
  );

-- ===========================================================================
-- SECURITY DEFINER: seed_world_system_resources must run as SECURITY DEFINER
-- so worlds created by a role that does not satisfy
-- resources_insert_world_admin still receive their Food and Fresh Water
-- seed rows.
-- ===========================================================================
select
  is (
    (
      select
        prosecdef
      from
        pg_proc
      where
        proname = 'seed_world_system_resources'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'seed_world_system_resources is SECURITY DEFINER'
  );

-- Simulate a non-owner-driven world creation path (e.g. service-driven world
-- creation): disable worlds RLS and grant INSERT to authenticated so an
-- authenticated non-admin can insert the world row. Resources RLS stays
-- enabled, so the seed trigger only succeeds if it runs as SECURITY DEFINER
-- (the function owner bypasses RLS) rather than as the invoking non-admin
-- role, which would fail the resources_insert_world_admin policy.
alter table public.worlds disable row level security;

grant insert on public.worlds to authenticated;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.worlds (id, name, visibility, status)
    values (
      'a2000000-0000-0000-0000-0000000000aa',
      'Res Non-Owner Insert World',
      'private',
      'active'
    )
  $test$,
    'seed trigger does not block world insert from a non-admin role'
  );

reset role;

revoke insert on public.worlds
from
  authenticated;

alter table public.worlds enable row level security;

select
  ok (
    exists (
      select
        1
      from
        public.resources
      where
        world_id = 'a2000000-0000-0000-0000-0000000000aa'
        and slug = 'food'
        and is_system_resource = true
    ),
    'seed trigger seeds Food when world is inserted by a non-owner role'
  );

select
  ok (
    exists (
      select
        1
      from
        public.resources
      where
        world_id = 'a2000000-0000-0000-0000-0000000000aa'
        and slug = 'fresh-water'
        and is_system_resource = true
    ),
    'seed trigger seeds Fresh Water when world is inserted by a non-owner role'
  );

select
  *
from
  finish ();

rollback;
