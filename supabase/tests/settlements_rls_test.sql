-- pgTAP tests for public.settlements RLS.
-- Run with: npx supabase test db
begin;

select
  plan (36);

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
  ),
  (
    '71000000-0000-0000-0000-000000000005',
    'settlements-nation-manager@example.com',
    'x',
    now(),
    '{"username":"settlements_nation_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    '71000000-0000-0000-0000-000000000006',
    'settlements-settlement-manager@example.com',
    'x',
    now(),
    '{"username":"settlements_settlement_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    '71000000-0000-0000-0000-000000000007',
    'settlements-plain-pc@example.com',
    'x',
    now(),
    '{"username":"settlements_plain_pc"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = '71000000-0000-0000-0000-000000000004';

insert into
  public.worlds (id, name, visibility, status)
values
  (
    '72000000-0000-0000-0000-000000000001',
    'Settlements Private World',
    'private',
    'active'
  ),
  (
    '72000000-0000-0000-0000-000000000002',
    'Settlements Public World',
    'public',
    'active'
  ),
  (
    '72000000-0000-0000-0000-000000000003',
    'Settlements Outsider World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    '72000000-0000-0000-0000-000000000001',
    '71000000-0000-0000-0000-000000000001'
  ),
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

insert into
  public.citizens (
    id,
    world_id,
    citizen_type,
    given_name,
    status,
    user_id,
    role_type,
    role_nation_id,
    role_settlement_id
  )
values
  (
    '75000000-0000-0000-0000-000000000001',
    '72000000-0000-0000-0000-000000000001',
    'player_character',
    'Nation Manager PC',
    'alive',
    '71000000-0000-0000-0000-000000000005',
    'nation_manager',
    '73000000-0000-0000-0000-000000000001',
    null
  ),
  (
    '75000000-0000-0000-0000-000000000002',
    '72000000-0000-0000-0000-000000000001',
    'player_character',
    'Settlement Manager PC',
    'alive',
    '71000000-0000-0000-0000-000000000006',
    'settlement_manager',
    null,
    '74000000-0000-0000-0000-000000000001'
  ),
  (
    '75000000-0000-0000-0000-000000000003',
    '72000000-0000-0000-0000-000000000001',
    'player_character',
    'Plain PC',
    'alive',
    '71000000-0000-0000-0000-000000000007',
    'none',
    null,
    null
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
    insert into public.settlements (id, nation_id, name)
    values (
      '74000000-0000-0000-0000-000000000004',
      '73000000-0000-0000-0000-000000000001',
      'Owner Manual Ready'
    )
  $test$,
    'owner can insert settlements in their world'
  );

select
  ok (
    (
      select
        is_ready_current_turn
      from
        public.set_settlement_readiness ('74000000-0000-0000-0000-000000000004', true)
    ),
    'owner can mark settlement ready via set_settlement_readiness'
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
    insert into public.settlements (id, nation_id, name)
    values (
      '74000000-0000-0000-0000-000000000005',
      '73000000-0000-0000-0000-000000000001',
      'Admin Auto Ready'
    )
  $test$,
    'world admin can insert settlements in administered world'
  );

select
  ok (
    (
      select
        auto_ready_enabled
      from
        public.set_settlement_auto_ready ('74000000-0000-0000-0000-000000000005', true)
    ),
    'world admin can enable auto-ready via set_settlement_auto_ready'
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
  is (
    (
      select
        count(*)::integer
      from
        public.update_settlement_coordinates (
          '74000000-0000-0000-0000-000000000005'::uuid,
          42.5,
          -17.25
        )
    ),
    1,
    'world admin can update settlement coordinates via function'
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
  is (
    (
      select
        count(*)::integer
      from
        public.update_settlement_coordinates (
          '74000000-0000-0000-0000-000000000006'::uuid,
          99.75,
          88.5
        )
    ),
    1,
    'super admin can update settlement coordinates via function'
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

-- ===========================================================================
-- NATION MANAGER: can read and update settlements in their nation.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000005","role":"authenticated"}';

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
    'nation manager can read settlements in their nation''s world'
  );

update public.settlements
set
  name = 'Nation Manager Update'
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
    'Nation Manager Update',
    'nation manager can update settlement in their nation'
  );

-- Restore name for subsequent tests.
update public.settlements
set
  name = 'Private Settlement'
where
  id = '74000000-0000-0000-0000-000000000001';

select
  is (
    (
      select
        count(*)::integer
      from
        public.update_settlement_coordinates (
          '74000000-0000-0000-0000-000000000001'::uuid,
          100.5,
          -50.25
        )
    ),
    0,
    'nation manager cannot update settlement coordinates via function (returns empty)'
  );

-- ===========================================================================
-- SETTLEMENT MANAGER: can update their assigned settlement.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000006","role":"authenticated"}';

update public.settlements
set
  name = 'Settlement Manager Update'
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
    'Settlement Manager Update',
    'settlement manager can update their assigned settlement'
  );

-- Restore name for subsequent tests.
update public.settlements
set
  name = 'Private Settlement'
where
  id = '74000000-0000-0000-0000-000000000001';

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000006","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.update_settlement_coordinates (
          '74000000-0000-0000-0000-000000000001'::uuid,
          100.5,
          -50.25
        )
    ),
    0,
    'settlement manager cannot update settlement coordinates via function (returns empty)'
  );

reset role;

-- ===========================================================================
-- PLAIN PC: player character without a management role can read but not update.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"71000000-0000-0000-0000-000000000007","role":"authenticated"}';

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
    'plain PC holder can read settlements in their world'
  );

update public.settlements
set
  name = 'Plain PC Update'
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
    'plain player character without management role cannot update settlements'
  );

rollback;
