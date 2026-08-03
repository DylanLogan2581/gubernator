-- pgTAP tests for public.grant_nation_resources: authority, settlement
-- ownership, and clamp-to-available / clamp-to-storage-cap behavior.
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
    'f1000000-0000-0000-0000-000000000001',
    'treasury-admin@example.com',
    'x',
    now(),
    '{"username":"treasury_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000002',
    'treasury-manager@example.com',
    'x',
    now(),
    '{"username":"treasury_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'f1000000-0000-0000-0000-000000000003',
    'treasury-outsider@example.com',
    'x',
    now(),
    '{"username":"treasury_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status, archived_at)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'Treasury World',
    'active',
    null
  ),
  (
    'f2000000-0000-0000-0000-000000000002',
    'Treasury Archived World',
    'archived',
    now()
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000001'
  ),
  (
    'f2000000-0000-0000-0000-000000000002',
    'f1000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'f3000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'Treasury Nation'
  ),
  (
    'f3000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000002',
    'Archived Treasury Nation'
  ),
  (
    'f3000000-0000-0000-0000-000000000003',
    'f2000000-0000-0000-0000-000000000001',
    'Other Treasury Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'f4000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-000000000001',
    'Treasury Nation Settlement'
  ),
  (
    'f4000000-0000-0000-0000-000000000002',
    'f3000000-0000-0000-0000-000000000003',
    'Other Nation Settlement'
  );

insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    user_id,
    role_type,
    role_nation_id
  )
values
  (
    'f5000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'f4000000-0000-0000-0000-000000000001',
    'player_character',
    'Treasury Manager',
    'alive',
    'f1000000-0000-0000-0000-000000000002',
    'nation_manager',
    'f3000000-0000-0000-0000-000000000001'
  );

insert into
  public.resources (id, world_id, name, slug, base_stockpile_cap)
values
  (
    'f6000000-0000-0000-0000-000000000001',
    'f2000000-0000-0000-0000-000000000001',
    'Treasury Grain',
    'treasury-grain',
    1000
  ),
  (
    'f6000000-0000-0000-0000-000000000002',
    'f2000000-0000-0000-0000-000000000001',
    'Treasury Timber',
    'treasury-timber',
    100
  );

-- Seed triggers populate zero-quantity nation/settlement stockpile rows for
-- every (nation, resource) / (settlement, resource) pair in the world; seed
-- explicit balances for the scenarios below.
update public.nation_resource_stockpiles
set
  quantity = 50
where
  nation_id = 'f3000000-0000-0000-0000-000000000001'
  and resource_id = 'f6000000-0000-0000-0000-000000000001';

update public.nation_resource_stockpiles
set
  quantity = 1000
where
  nation_id = 'f3000000-0000-0000-0000-000000000001'
  and resource_id = 'f6000000-0000-0000-0000-000000000002';

update public.settlement_resource_stockpiles
set
  quantity = 90
where
  settlement_id = 'f4000000-0000-0000-0000-000000000001'
  and resource_id = 'f6000000-0000-0000-0000-000000000002';

-- ===========================================================================
-- RPC: outsider (no manage authority) cannot grant.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.grant_nation_resources(
      'f3000000-0000-0000-0000-000000000001'::uuid,
      'f4000000-0000-0000-0000-000000000001'::uuid,
      'f6000000-0000-0000-0000-000000000001'::uuid,
      10
    )
  $test$,
    '42501',
    null,
    'outsider cannot grant nation resources'
  );

reset role;

-- ===========================================================================
-- RPC: settlement that does not belong to the nation is rejected.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.grant_nation_resources(
      'f3000000-0000-0000-0000-000000000001'::uuid,
      'f4000000-0000-0000-0000-000000000002'::uuid,
      'f6000000-0000-0000-0000-000000000001'::uuid,
      10
    )
  $test$,
    'P0002',
    null,
    'granting to a settlement outside the nation is rejected'
  );

reset role;

-- ===========================================================================
-- RPC: archived worlds are read-only.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.grant_nation_resources(
      'f3000000-0000-0000-0000-000000000002'::uuid,
      'f4000000-0000-0000-0000-000000000099'::uuid,
      'f6000000-0000-0000-0000-000000000099'::uuid,
      10
    )
  $test$,
    '22023',
    'Archived worlds are read-only.',
    'archived worlds reject grants'
  );

reset role;

-- ===========================================================================
-- RPC: manager can grant within available stock (no clamp).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

create temporary table t_grant_ok as
select
  *
from
  public.grant_nation_resources (
    'f3000000-0000-0000-0000-000000000001'::uuid,
    'f4000000-0000-0000-0000-000000000001'::uuid,
    'f6000000-0000-0000-0000-000000000001'::uuid,
    10
  );

reset role;

select
  is (
    (
      select
        granted_quantity
      from
        t_grant_ok
    ),
    10::numeric,
    'grant within available stock returns the full requested quantity'
  );

select
  is (
    (
      select
        clamped
      from
        t_grant_ok
    ),
    false,
    'grant within available stock is not clamped'
  );

select
  is (
    (
      select
        quantity
      from
        public.nation_resource_stockpiles
      where
        nation_id = 'f3000000-0000-0000-0000-000000000001'
        and resource_id = 'f6000000-0000-0000-0000-000000000001'
    ),
    40::numeric,
    'nation stockpile is debited by the granted quantity'
  );

select
  is (
    (
      select
        quantity
      from
        public.settlement_resource_stockpiles
      where
        settlement_id = 'f4000000-0000-0000-0000-000000000001'
        and resource_id = 'f6000000-0000-0000-0000-000000000001'
    ),
    10::numeric,
    'settlement stockpile is credited by the granted quantity'
  );

-- ===========================================================================
-- RPC: grant clamps to the nation's remaining stock.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

create temporary table t_grant_clamped_stock as
select
  *
from
  public.grant_nation_resources (
    'f3000000-0000-0000-0000-000000000001'::uuid,
    'f4000000-0000-0000-0000-000000000001'::uuid,
    'f6000000-0000-0000-0000-000000000001'::uuid,
    1000
  );

reset role;

select
  is (
    (
      select
        granted_quantity
      from
        t_grant_clamped_stock
    ),
    40::numeric,
    'grant clamps to the nation''s remaining stock'
  );

select
  is (
    (
      select
        clamped
      from
        t_grant_clamped_stock
    ),
    true,
    'grant over available stock is reported as clamped'
  );

select
  is (
    (
      select
        quantity
      from
        public.nation_resource_stockpiles
      where
        nation_id = 'f3000000-0000-0000-0000-000000000001'
        and resource_id = 'f6000000-0000-0000-0000-000000000001'
    ),
    0::numeric,
    'nation stockpile never goes negative'
  );

select
  is (
    (
      select
        quantity
      from
        public.settlement_resource_stockpiles
      where
        settlement_id = 'f4000000-0000-0000-0000-000000000001'
        and resource_id = 'f6000000-0000-0000-0000-000000000001'
    ),
    50::numeric,
    'settlement stockpile receives only the clamped amount'
  );

-- ===========================================================================
-- RPC: grant clamps to the settlement's remaining storage space.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f1000000-0000-0000-0000-000000000002","role":"authenticated"}';

create temporary table t_grant_clamped_cap as
select
  *
from
  public.grant_nation_resources (
    'f3000000-0000-0000-0000-000000000001'::uuid,
    'f4000000-0000-0000-0000-000000000001'::uuid,
    'f6000000-0000-0000-0000-000000000002'::uuid,
    50
  );

reset role;

select
  is (
    (
      select
        granted_quantity
      from
        t_grant_clamped_cap
    ),
    10::numeric,
    'grant clamps to the settlement''s remaining storage space'
  );

select
  is (
    (
      select
        clamped
      from
        t_grant_clamped_cap
    ),
    true,
    'grant limited by storage cap is reported as clamped'
  );

select
  is (
    (
      select
        quantity
      from
        public.nation_resource_stockpiles
      where
        nation_id = 'f3000000-0000-0000-0000-000000000001'
        and resource_id = 'f6000000-0000-0000-0000-000000000002'
    ),
    990::numeric,
    'nation stockpile is debited only by the storage-capped amount'
  );

select
  is (
    (
      select
        quantity
      from
        public.settlement_resource_stockpiles
      where
        settlement_id = 'f4000000-0000-0000-0000-000000000001'
        and resource_id = 'f6000000-0000-0000-0000-000000000002'
    ),
    100::numeric,
    'settlement stockpile never exceeds its effective storage cap'
  );

select
  *
from
  finish ();

rollback;
