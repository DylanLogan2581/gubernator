-- pgTAP tests for public.set_settlement_stockpile_quantity RPC.
-- Run with: npx supabase test db
begin;

select
  plan (13);

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
    'd1000000-0000-0000-0000-000000000001',
    'sssq-owner@example.com',
    'x',
    now(),
    '{"username":"sssq_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000002',
    'sssq-world-admin@example.com',
    'x',
    now(),
    '{"username":"sssq_world_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000003',
    'sssq-superadmin@example.com',
    'x',
    now(),
    '{"username":"sssq_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000004',
    'sssq-nation-manager@example.com',
    'x',
    now(),
    '{"username":"sssq_nation_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000005',
    'sssq-settlement-manager@example.com',
    'x',
    now(),
    '{"username":"sssq_settlement_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000006',
    'sssq-anon@example.com',
    'x',
    now(),
    '{"username":"sssq_anon"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000007',
    'sssq-other-world-owner@example.com',
    'x',
    now(),
    '{"username":"sssq_other_world_owner"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'd1000000-0000-0000-0000-000000000003';

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'd2000000-0000-0000-0000-000000000001',
    'SSSQ Private World',
    'private',
    'active'
  ),
  (
    'd2000000-0000-0000-0000-000000000002',
    'SSSQ Other World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'd2000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001'
  ),
  (
    'd2000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'd3000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'SSSQ Nation'
  );

-- Settlement insert fires settlements_seed_stockpiles which seeds zero-quantity
-- rows for Food + Fresh Water (the world's system resources).
insert into
  public.settlements (id, nation_id, name)
values
  (
    'd4000000-0000-0000-0000-000000000001',
    'd3000000-0000-0000-0000-000000000001',
    'SSSQ Settlement'
  );

-- Explicit non-system resource in the primary world.
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'd5000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'Iron Ore',
    'iron-ore-sssq'
  );

-- Stockpile row for Iron Ore was seeded by resources_seed_stockpiles; verify it exists.
-- We do NOT delete it here so the normal update path is exercised.
-- A resource belonging to the other world (for the cross-world rejection test).
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'd5000000-0000-0000-0000-000000000002',
    'd2000000-0000-0000-0000-000000000002',
    'Other World Resource',
    'other-world-resource-sssq'
  );

-- A trashed resource in the primary world.
insert into
  public.resources (id, world_id, name, slug, is_trashed)
values
  (
    'd5000000-0000-0000-0000-000000000003',
    'd2000000-0000-0000-0000-000000000001',
    'Trashed Resource',
    'trashed-resource-sssq',
    true
  );

-- Citizens for role-based rejection tests.
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
    'd7000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'player_character',
    'SSSQ Nation Manager PC',
    'alive',
    'd1000000-0000-0000-0000-000000000004',
    'nation_manager',
    'd3000000-0000-0000-0000-000000000001',
    null
  ),
  (
    'd7000000-0000-0000-0000-000000000002',
    'd2000000-0000-0000-0000-000000000001',
    'player_character',
    'SSSQ Settlement Manager PC',
    'alive',
    'd1000000-0000-0000-0000-000000000005',
    'settlement_manager',
    null,
    'd4000000-0000-0000-0000-000000000001'
  );

-- ===========================================================================
-- WORLD OWNER (implicit world admin): success
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        (
          public.set_settlement_stockpile_quantity (
            'd4000000-0000-0000-0000-000000000001',
            'd5000000-0000-0000-0000-000000000001',
            42.5
          )
        ).quantity
    ),
    42.5::numeric,
    'world owner can set stockpile quantity'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: success
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        (
          public.set_settlement_stockpile_quantity (
            'd4000000-0000-0000-0000-000000000001',
            'd5000000-0000-0000-0000-000000000001',
            100
          )
        ).quantity
    ),
    100::numeric,
    'world admin can set stockpile quantity'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: success (cross-world)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        (
          public.set_settlement_stockpile_quantity (
            'd4000000-0000-0000-0000-000000000001',
            'd5000000-0000-0000-0000-000000000001',
            999
          )
        ).quantity
    ),
    999::numeric,
    'super admin can set stockpile quantity in any world'
  );

reset role;

-- ===========================================================================
-- NATION MANAGER: rejected (42501)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_settlement_stockpile_quantity(
      'd4000000-0000-0000-0000-000000000001',
      'd5000000-0000-0000-0000-000000000001',
      50
    )
  $test$,
    '42501',
    null,
    'nation manager is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- SETTLEMENT MANAGER: rejected (42501)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_settlement_stockpile_quantity(
      'd4000000-0000-0000-0000-000000000001',
      'd5000000-0000-0000-0000-000000000001',
      50
    )
  $test$,
    '42501',
    null,
    'settlement manager is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- ANONYMOUS: rejected (42501)
-- Unauthenticated users see no rows and the auth helpers return false.
-- ===========================================================================
set
  local role anon;

set
  local "request.jwt.claims" = '{}';

select
  throws_ok (
    $test$
    select public.set_settlement_stockpile_quantity(
      'd4000000-0000-0000-0000-000000000001',
      'd5000000-0000-0000-0000-000000000001',
      50
    )
  $test$,
    '42501',
    null,
    'anonymous caller is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- SOFT-DELETED RESOURCE: rejected (P0001)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_settlement_stockpile_quantity(
      'd4000000-0000-0000-0000-000000000001',
      'd5000000-0000-0000-0000-000000000003',
      10
    )
  $test$,
    'P0001',
    null,
    'trashed resource is rejected with P0001'
  );

reset role;

-- ===========================================================================
-- CROSS-WORLD RESOURCE: rejected (42501)
-- A resource belonging to a different world is treated as forbidden.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_settlement_stockpile_quantity(
      'd4000000-0000-0000-0000-000000000001',
      'd5000000-0000-0000-0000-000000000002',
      10
    )
  $test$,
    '42501',
    null,
    'resource from a different world is rejected with 42501'
  );

reset role;

-- ===========================================================================
-- MISSING ROW: upsert path
-- Manually delete the Iron Ore stockpile row, then call the RPC to exercise
-- the insert-on-missing branch.
-- ===========================================================================
delete from public.settlement_resource_stockpiles
where
  settlement_id = 'd4000000-0000-0000-0000-000000000001'
  and resource_id = 'd5000000-0000-0000-0000-000000000001';

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        (
          public.set_settlement_stockpile_quantity (
            'd4000000-0000-0000-0000-000000000001',
            'd5000000-0000-0000-0000-000000000001',
            77
          )
        ).quantity
    ),
    77::numeric,
    'RPC upserts when the stockpile row is missing'
  );

-- Verify the row was actually created.
select
  is (
    (
      select
        quantity
      from
        public.settlement_resource_stockpiles
      where
        settlement_id = 'd4000000-0000-0000-0000-000000000001'
        and resource_id = 'd5000000-0000-0000-0000-000000000001'
    ),
    77::numeric,
    'upserted row has correct quantity in the table'
  );

reset role;

-- ===========================================================================
-- SECURITY DEFINER: function must be SECURITY DEFINER
-- ===========================================================================
select
  is (
    (
      select
        prosecdef
      from
        pg_proc
      where
        proname = 'set_settlement_stockpile_quantity'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'set_settlement_stockpile_quantity is SECURITY DEFINER'
  );

-- ===========================================================================
-- QUANTITY NOT CLAMPED: admin can set a quantity above effective_cap
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        (
          public.set_settlement_stockpile_quantity (
            'd4000000-0000-0000-0000-000000000001',
            'd5000000-0000-0000-0000-000000000001',
            9999999
          )
        ).quantity
    ),
    9999999::numeric,
    'quantity is not clamped to the effective cap (admin may intentionally exceed)'
  );

-- Verify quantity persisted above default base_stockpile_cap.
select
  ok (
    (
      select
        quantity > 0
      from
        public.settlement_resource_stockpiles
      where
        settlement_id = 'd4000000-0000-0000-0000-000000000001'
        and resource_id = 'd5000000-0000-0000-0000-000000000001'
    ),
    'quantity persisted above zero after large set'
  );

reset role;

select
  *
from
  finish ();

rollback;
