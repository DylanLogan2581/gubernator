-- pgTAP tests for public.settlement_resource_stockpiles RLS and seed triggers.
-- Run with: npx supabase test db
begin;

select
  plan (18);

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
    'stock-owner@example.com',
    'x',
    now(),
    '{"username":"stock_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    'stock-admin@example.com',
    'x',
    now(),
    '{"username":"stock_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000003',
    'stock-outsider@example.com',
    'x',
    now(),
    '{"username":"stock_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000004',
    'stock-superadmin@example.com',
    'x',
    now(),
    '{"username":"stock_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000005',
    'stock-nation-manager@example.com',
    'x',
    now(),
    '{"username":"stock_nation_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000006',
    'stock-settlement-manager@example.com',
    'x',
    now(),
    '{"username":"stock_settlement_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'c1000000-0000-0000-0000-000000000007',
    'stock-pc-holder@example.com',
    'x',
    now(),
    '{"username":"stock_pc_holder"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'c1000000-0000-0000-0000-000000000004';

-- Inserting worlds fires the seed trigger so Food and Fresh Water resources are
-- created automatically for each world.
insert into
  public.worlds (id, name, visibility, status)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'Stock Private World',
    'private',
    'active'
  ),
  (
    'c2000000-0000-0000-0000-000000000002',
    'Stock Outsider World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000002'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'c3000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000001',
    'Stock Private Nation'
  );

-- Inserting this settlement fires settlements_seed_stockpiles, which seeds one
-- zero-quantity row for each active resource in the world (Food + Fresh Water).
insert into
  public.settlements (id, nation_id, name)
values
  (
    'c4000000-0000-0000-0000-000000000001',
    'c3000000-0000-0000-0000-000000000001',
    'Stock Private Settlement'
  );

-- Insert a non-system resource with an explicit ID so write tests can
-- reference it predictably. Inserting it fires resources_seed_stockpiles,
-- which seeds one row for c4...01. Remove that row immediately so admin write
-- tests can exercise INSERT independently.
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'c5000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000001',
    'Iron Ore',
    'iron-ore'
  );

delete from public.settlement_resource_stockpiles
where
  settlement_id = 'c4000000-0000-0000-0000-000000000001'
  and resource_id = 'c5000000-0000-0000-0000-000000000001';

-- Citizens: nation manager, settlement manager, and a plain PC (no role).
-- These must be inserted as postgres (superuser) to bypass citizen RLS.
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
    'c7000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000001',
    'player_character',
    'Stock Nation Manager PC',
    'alive',
    'c1000000-0000-0000-0000-000000000005',
    'nation_manager',
    'c3000000-0000-0000-0000-000000000001',
    null
  ),
  (
    'c7000000-0000-0000-0000-000000000002',
    'c2000000-0000-0000-0000-000000000001',
    'player_character',
    'Stock Settlement Manager PC',
    'alive',
    'c1000000-0000-0000-0000-000000000006',
    'settlement_manager',
    null,
    'c4000000-0000-0000-0000-000000000001'
  ),
  (
    'c7000000-0000-0000-0000-000000000003',
    'c2000000-0000-0000-0000-000000000001',
    'player_character',
    'Stock Plain PC',
    'alive',
    'c1000000-0000-0000-0000-000000000007',
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
        public.settlement_resource_stockpiles
    ),
    0,
    'anon cannot read settlement_resource_stockpiles'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: cannot read private-world stockpiles
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
        public.settlement_resource_stockpiles srs
        join public.settlements s on s.id = srs.settlement_id
        join public.nations n on n.id = s.nation_id
      where
        n.world_id = 'c2000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read stockpiles in an inaccessible private world'
  );

reset role;

-- ===========================================================================
-- PC HOLDER: player character in private world can read stockpiles via
-- current_user_has_world_access (player-character path)
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000007","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.settlement_resource_stockpiles
      where
        settlement_id = 'c4000000-0000-0000-0000-000000000001'
    ),
    'player character holder can read stockpiles in their world'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: can read and manage stockpiles in the administered world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.settlement_resource_stockpiles
      where
        settlement_id = 'c4000000-0000-0000-0000-000000000001'
    ),
    'world admin can read stockpiles in administered world'
  );

select
  lives_ok (
    $test$
    insert into public.settlement_resource_stockpiles (id, settlement_id, resource_id, quantity)
    values (
      'c6000000-0000-0000-0000-000000000001',
      'c4000000-0000-0000-0000-000000000001',
      'c5000000-0000-0000-0000-000000000001',
      0
    )
  $test$,
    'world admin can insert a stockpile row'
  );

select
  lives_ok (
    $test$
    update public.settlement_resource_stockpiles
    set quantity = 500
    where id = 'c6000000-0000-0000-0000-000000000001'
  $test$,
    'world admin can update stockpile quantity'
  );

select
  lives_ok (
    $test$
    delete from public.settlement_resource_stockpiles
    where id = 'c6000000-0000-0000-0000-000000000001'
  $test$,
    'world admin can delete a stockpile row'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: can manage stockpiles in any world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.settlement_resource_stockpiles (id, settlement_id, resource_id, quantity)
    values (
      'c6000000-0000-0000-0000-000000000002',
      'c4000000-0000-0000-0000-000000000001',
      'c5000000-0000-0000-0000-000000000001',
      0
    )
  $test$,
    'super admin can insert a stockpile row in any world'
  );

select
  lives_ok (
    $test$
    update public.settlement_resource_stockpiles
    set quantity = 750
    where id = 'c6000000-0000-0000-0000-000000000002'
  $test$,
    'super admin can update stockpile quantity in any world'
  );

reset role;

-- ===========================================================================
-- NATION MANAGER: direct write denied
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.settlement_resource_stockpiles (settlement_id, resource_id, quantity)
    values (
      'c4000000-0000-0000-0000-000000000001',
      'c5000000-0000-0000-0000-000000000001',
      0
    )
  $test$,
    '42501',
    null,
    'nation manager cannot directly insert stockpile rows'
  );

reset role;

-- ===========================================================================
-- SETTLEMENT MANAGER: direct write denied
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000006","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.settlement_resource_stockpiles (settlement_id, resource_id, quantity)
    values (
      'c4000000-0000-0000-0000-000000000001',
      'c5000000-0000-0000-0000-000000000001',
      0
    )
  $test$,
    '42501',
    null,
    'settlement manager cannot directly insert stockpile rows'
  );

reset role;

-- ===========================================================================
-- CROSS-WORLD: world admin of a different world cannot write stockpiles for
-- settlements outside their administered world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.settlement_resource_stockpiles (settlement_id, resource_id, quantity)
    values (
      'c4000000-0000-0000-0000-000000000001',
      'c5000000-0000-0000-0000-000000000001',
      0
    )
  $test$,
    '42501',
    null,
    'world admin of a different world cannot insert stockpile for settlement in another world'
  );

reset role;

-- ===========================================================================
-- CONSTRAINT: quantity = -1 is rejected by the check constraint
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.settlement_resource_stockpiles (settlement_id, resource_id, quantity)
    values (
      'c4000000-0000-0000-0000-000000000001',
      'c5000000-0000-0000-0000-000000000001',
      -1
    )
  $test$,
    '23514',
    null,
    'quantity = -1 is rejected by the non-negative check constraint'
  );

-- ===========================================================================
-- SEED TRIGGER: settlements_seed_stockpiles
-- Inserting a new settlement in a world that already has resources seeds one
-- zero-quantity stockpile row per active resource.
-- ===========================================================================
insert into
  public.worlds (id, name, visibility, status)
values
  (
    'c2000000-0000-0000-0000-000000000099',
    'Stock Trigger Test World',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'c3000000-0000-0000-0000-000000000099',
    'c2000000-0000-0000-0000-000000000099',
    'Stock Trigger Nation'
  );

-- World has 2 active resources (Food + Fresh Water seeded by world insert).
insert into
  public.settlements (id, nation_id, name)
values
  (
    'c4000000-0000-0000-0000-000000000099',
    'c3000000-0000-0000-0000-000000000099',
    'Stock Trigger Settlement'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_resource_stockpiles
      where
        settlement_id = 'c4000000-0000-0000-0000-000000000099'
    ),
    2,
    'settlement insert trigger seeds one stockpile row per active resource'
  );

-- ===========================================================================
-- SEED TRIGGER: resources_seed_stockpiles
-- Inserting a new resource in a world that already has settlements seeds one
-- zero-quantity stockpile row per existing settlement.
-- ===========================================================================
insert into
  public.resources (id, world_id, name, slug)
values
  (
    'c5000000-0000-0000-0000-000000000099',
    'c2000000-0000-0000-0000-000000000099',
    'Copper',
    'copper'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_resource_stockpiles
      where
        settlement_id = 'c4000000-0000-0000-0000-000000000099'
    ),
    3,
    'resource insert trigger seeds one stockpile row per existing settlement'
  );

-- ===========================================================================
-- SEED TRIGGER: soft-deleted resources are not seeded for new settlements
-- ===========================================================================
update public.resources
set
  is_trashed = true
where
  id = 'c5000000-0000-0000-0000-000000000099';

insert into
  public.settlements (id, nation_id, name)
values
  (
    'c4000000-0000-0000-0000-000000000098',
    'c3000000-0000-0000-0000-000000000099',
    'Stock Trigger Settlement B'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_resource_stockpiles
      where
        settlement_id = 'c4000000-0000-0000-0000-000000000098'
    ),
    2,
    'settlement insert trigger does not seed rows for trashed resources'
  );

-- ===========================================================================
-- SECURITY DEFINER: both seed functions must be SECURITY DEFINER so they can
-- insert stockpile rows even when the invoking role is not a world admin.
-- ===========================================================================
select
  is (
    (
      select
        prosecdef
      from
        pg_proc
      where
        proname = 'seed_settlement_stockpiles_on_settlement_insert'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'seed_settlement_stockpiles_on_settlement_insert is SECURITY DEFINER'
  );

select
  is (
    (
      select
        prosecdef
      from
        pg_proc
      where
        proname = 'seed_stockpiles_on_resource_insert'
        and pronamespace = 'public'::regnamespace
    ),
    true,
    'seed_stockpiles_on_resource_insert is SECURITY DEFINER'
  );

select
  *
from
  finish ();

rollback;
