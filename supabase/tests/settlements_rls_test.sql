-- pgTAP tests for public.settlements RLS.
-- Run with: npx supabase test db
begin;

select
  plan (27);

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
    '71000000-0000-0000-0000-000000000001',
    'settlements-owner@example.com',
    'x',
    now(),
    '{"username":"settlements_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    '71000000-0000-0000-0000-000000000002',
    'settlements-admin@example.com',
    'x',
    now(),
    '{"username":"settlements_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '71000000-0000-0000-0000-000000000003',
    'settlements-outsider@example.com',
    'x',
    now(),
    '{"username":"settlements_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    '71000000-0000-0000-0000-000000000004',
    'settlements-superadmin@example.com',
    'x',
    now(),
    '{"username":"settlements_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = '71000000-0000-0000-0000-000000000004';

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    '72000000-0000-0000-0000-000000000001',
    'Settlements Private World',
    '71000000-0000-0000-0000-000000000001',
    'private',
    'active'
  ),
  (
    '72000000-0000-0000-0000-000000000002',
    'Settlements Public World',
    '71000000-0000-0000-0000-000000000001',
    'public',
    'active'
  ),
  (
    '72000000-0000-0000-0000-000000000003',
    'Settlements Outsider World',
    '71000000-0000-0000-0000-000000000003',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    '72000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    '73000000-0000-0000-0000-000000000001',
    '72000000-0000-0000-0000-000000000001',
    'Private Nation'
  ),
  (
    '73000000-0000-0000-0000-000000000002',
    '72000000-0000-0000-0000-000000000002',
    'Public Nation'
  ),
  (
    '73000000-0000-0000-0000-000000000003',
    '72000000-0000-0000-0000-000000000003',
    'Outsider Nation'
  );

insert into
  public.settlements (
    id,
    nation_id,
    name,
    description,
    coord_x,
    coord_z,
    auto_ready_enabled,
    is_ready_current_turn
  )
values
  (
    '74000000-0000-0000-0000-000000000001',
    '73000000-0000-0000-0000-000000000001',
    'Private Settlement',
    'Private world settlement',
    10.125,
    -20.5,
    false,
    false
  ),
  (
    '74000000-0000-0000-0000-000000000002',
    '73000000-0000-0000-0000-000000000002',
    'Public Settlement',
    null,
    null,
    null,
    false,
    false
  ),
  (
    '74000000-0000-0000-0000-000000000003',
    '73000000-0000-0000-0000-000000000003',
    'Outsider Settlement',
    null,
    null,
    null,
    true,
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
        public.settlements
    ),
    0,
    'anon cannot read settlements'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: can read public-world settlements, not inaccessible private-world
-- settlements, and cannot manage settlements outside an administered world.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.settlements
      where
        id = '74000000-0000-0000-0000-000000000002'
    ),
    'outsider can read public-world settlements'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.settlements
      where
        id = '74000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read inaccessible private-world settlements'
  );

select
  throws_ok (
    $test$
    insert into public.settlements (nation_id, name)
    values ('73000000-0000-0000-0000-000000000001', 'Outsider Private Insert')
  $test$,
    '42501',
    null,
    'outsider cannot insert settlements into inaccessible private worlds'
  );

select
  throws_ok (
    $test$
    insert into public.settlements (nation_id, name)
    values ('73000000-0000-0000-0000-000000000002', 'Outsider Public Insert')
  $test$,
    '42501',
    null,
    'outsider cannot insert settlements into readable public worlds without admin access'
  );

update public.settlements
set
  name = 'Outsider Private Update'
where
  id = '74000000-0000-0000-0000-000000000001';

reset role;

select
  is (
    (
      select
        name
      from
        public.settlements
      where
        id = '74000000-0000-0000-0000-000000000001'
    ),
    'Private Settlement',
    'outsider cannot update inaccessible private-world settlements'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}';

update public.settlements
set
  name = 'Outsider Public Update'
where
  id = '74000000-0000-0000-0000-000000000002';

reset role;

select
  is (
    (
      select
        name
      from
        public.settlements
      where
        id = '74000000-0000-0000-0000-000000000002'
    ),
    'Public Settlement',
    'outsider cannot update public-world settlements without admin access'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}';

delete from public.settlements
where
  id = '74000000-0000-0000-0000-000000000001';

reset role;

select
  ok (
    exists (
      select
        1
      from
        public.settlements
      where
        id = '74000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot delete inaccessible private-world settlements'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000003","role":"authenticated"}';

delete from public.settlements
where
  id = '74000000-0000-0000-0000-000000000002';

reset role;

select
  ok (
    exists (
      select
        1
      from
        public.settlements
      where
        id = '74000000-0000-0000-0000-000000000002'
    ),
    'outsider cannot delete public-world settlements without admin access'
  );

-- ===========================================================================
-- OWNER: world owners can manage settlements.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.settlements
      where
        id = '74000000-0000-0000-0000-000000000001'
    ),
    'owner can read settlements in their world'
  );

select
  lives_ok (
    $test$
    insert into public.settlements (
      id,
      nation_id,
      name,
      is_ready_current_turn,
      ready_set_at,
      ready_set_by_citizen_id
    )
    values (
      '74000000-0000-0000-0000-000000000004',
      '73000000-0000-0000-0000-000000000001',
      'Owner Manual Ready',
      true,
      now(),
      '75000000-0000-0000-0000-000000000001'
    )
  $test$,
    'owner can insert manually ready settlements in their world'
  );

select
  ok (
    exists (
      select
        1
      from
        public.settlements
      where
        id = '74000000-0000-0000-0000-000000000004'
        and is_ready_current_turn = true
        and ready_set_at is not null
        and ready_set_by_citizen_id = '75000000-0000-0000-0000-000000000001'
    ),
    'manual ready state can be represented on the settlement row'
  );

select
  lives_ok (
    $test$
    update public.settlements
    set description = 'Owner update'
    where id = '74000000-0000-0000-0000-000000000004'
  $test$,
    'owner can update settlements in their world'
  );

select
  lives_ok (
    $test$
    delete from public.settlements
    where id = '74000000-0000-0000-0000-000000000004'
  $test$,
    'owner can delete settlements in their world'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: explicit world admins can manage settlements.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.settlements
      where
        id = '74000000-0000-0000-0000-000000000001'
    ),
    'world admin can read settlements in administered world'
  );

select
  lives_ok (
    $test$
    insert into public.settlements (
      id,
      nation_id,
      name,
      auto_ready_enabled,
      is_ready_current_turn
    )
    values (
      '74000000-0000-0000-0000-000000000005',
      '73000000-0000-0000-0000-000000000001',
      'Admin Auto Ready',
      true,
      true
    )
  $test$,
    'world admin can insert auto-ready settlements in administered world'
  );

select
  ok (
    exists (
      select
        1
      from
        public.settlements
      where
        id = '74000000-0000-0000-0000-000000000005'
        and auto_ready_enabled = true
        and is_ready_current_turn = true
    ),
    'auto-ready state can be represented on the settlement row'
  );

select
  lives_ok (
    $test$
    update public.settlements
    set name = 'Admin Update'
    where id = '74000000-0000-0000-0000-000000000005'
  $test$,
    'world admin can update settlements in administered world'
  );

select
  lives_ok (
    $test$
    delete from public.settlements
    where id = '74000000-0000-0000-0000-000000000005'
  $test$,
    'world admin can delete settlements in administered world'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: can read and manage settlements across worlds.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlements
      where
        id in (
          '74000000-0000-0000-0000-000000000001',
          '74000000-0000-0000-0000-000000000002',
          '74000000-0000-0000-0000-000000000003'
        )
    ),
    3,
    'super admin can read settlements across worlds'
  );

select
  lives_ok (
    $test$
    insert into public.settlements (id, nation_id, name)
    values (
      '74000000-0000-0000-0000-000000000006',
      '73000000-0000-0000-0000-000000000003',
      'Super Admin Insert'
    )
  $test$,
    'super admin can insert settlements in any world'
  );

select
  lives_ok (
    $test$
    update public.settlements
    set description = 'Super admin update'
    where id = '74000000-0000-0000-0000-000000000006'
  $test$,
    'super admin can update settlements in any world'
  );

select
  lives_ok (
    $test$
    delete from public.settlements
    where id = '74000000-0000-0000-0000-000000000006'
  $test$,
    'super admin can delete settlements in any world'
  );

reset role;

-- ===========================================================================
-- DEFAULTS AND CONSTRAINTS
-- ===========================================================================
select
  lives_ok (
    $test$
    insert into public.settlements (id, nation_id, name)
    values (
      '74000000-0000-0000-0000-000000000007',
      '73000000-0000-0000-0000-000000000001',
      'Default Readiness Flags'
    )
  $test$,
    'settlements can be inserted without optional description, coordinates, or readiness fields'
  );

select
  is (
    (
      select
        auto_ready_enabled
      from
        public.settlements
      where
        id = '74000000-0000-0000-0000-000000000007'
    ),
    false,
    'auto_ready_enabled defaults to false'
  );

select
  is (
    (
      select
        is_ready_current_turn
      from
        public.settlements
      where
        id = '74000000-0000-0000-0000-000000000007'
    ),
    false,
    'is_ready_current_turn defaults to false'
  );

select
  throws_ok (
    $test$
    insert into public.settlements (nation_id, name)
    values ('73000000-0000-0000-0000-000000000001', '')
  $test$,
    '23514',
    null,
    'settlements require a non-empty name'
  );

rollback;
