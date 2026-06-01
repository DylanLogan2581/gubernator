-- pgTAP tests for public.deposit_instances RLS and max_workers constraint.
-- Run with: npx supabase test db
begin;

select
  plan (11);

-- ---------------------------------------------------------------------------
-- Fixtures
-- UUID ranges (all numeric, unique to this file):
--   31xxxxxx = users          32xxxxxx = worlds
--   33xxxxxx = nations        34xxxxxx = settlements
--   35xxxxxx = job_definitions 36xxxxxx = deposit_types
--   37xxxxxx = deposit_instances 38xxxxxx = citizens
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
    '31000000-0000-0000-0000-000000000001',
    'di-owner@example.com',
    'x',
    now(),
    '{"username":"di_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    '31000000-0000-0000-0000-000000000002',
    'di-admin@example.com',
    'x',
    now(),
    '{"username":"di_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '31000000-0000-0000-0000-000000000003',
    'di-outsider@example.com',
    'x',
    now(),
    '{"username":"di_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    '31000000-0000-0000-0000-000000000004',
    'di-super@example.com',
    'x',
    now(),
    '{"username":"di_super"}'::jsonb,
    now(),
    now()
  ),
  (
    '31000000-0000-0000-0000-000000000005',
    'di-nation-mgr@example.com',
    'x',
    now(),
    '{"username":"di_nation_mgr"}'::jsonb,
    now(),
    now()
  ),
  (
    '31000000-0000-0000-0000-000000000006',
    'di-settlement-mgr@example.com',
    'x',
    now(),
    '{"username":"di_settlement_mgr"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = '31000000-0000-0000-0000-000000000004';

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    '32000000-0000-0000-0000-000000000001',
    'DI Private World',
    '31000000-0000-0000-0000-000000000001',
    'private',
    'active'
  ),
  (
    '32000000-0000-0000-0000-000000000002',
    'DI Outsider World',
    '31000000-0000-0000-0000-000000000003',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    '32000000-0000-0000-0000-000000000001',
    '31000000-0000-0000-0000-000000000002'
  );

-- Deposit job required for job_id FK on deposit_types.
insert into
  public.job_definitions (id, world_id, name, slug, job_type)
values
  (
    '35000000-0000-0000-0000-000000000001',
    '32000000-0000-0000-0000-000000000001',
    'DI Mining',
    'di-mining',
    'deposit'
  );

insert into
  public.deposit_types (
    id,
    world_id,
    name,
    slug,
    job_id,
    output_units_per_worker
  )
values
  (
    '36000000-0000-0000-0000-000000000001',
    '32000000-0000-0000-0000-000000000001',
    'DI Iron Deposit',
    'di-iron-deposit',
    '35000000-0000-0000-0000-000000000001',
    5
  );

insert into
  public.nations (id, world_id, name)
values
  (
    '33000000-0000-0000-0000-000000000001',
    '32000000-0000-0000-0000-000000000001',
    'DI Nation'
  ),
  (
    '33000000-0000-0000-0000-000000000002',
    '32000000-0000-0000-0000-000000000002',
    'DI Outsider Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    '34000000-0000-0000-0000-000000000001',
    '33000000-0000-0000-0000-000000000001',
    'DI Settlement'
  ),
  (
    '34000000-0000-0000-0000-000000000002',
    '33000000-0000-0000-0000-000000000002',
    'DI Outsider Settlement'
  );

-- Nation manager and settlement manager citizens.
insert into
  public.citizens (
    id,
    world_id,
    citizen_type,
    name,
    status,
    user_id,
    role_type,
    role_nation_id,
    role_settlement_id
  )
values
  (
    '38000000-0000-0000-0000-000000000001',
    '32000000-0000-0000-0000-000000000001',
    'player_character',
    'DI Nation Manager PC',
    'alive',
    '31000000-0000-0000-0000-000000000005',
    'nation_manager',
    '33000000-0000-0000-0000-000000000001',
    null
  ),
  (
    '38000000-0000-0000-0000-000000000002',
    '32000000-0000-0000-0000-000000000001',
    'player_character',
    'DI Settlement Manager PC',
    'alive',
    '31000000-0000-0000-0000-000000000006',
    'settlement_manager',
    null,
    '34000000-0000-0000-0000-000000000001'
  );

-- Seed one deposit instance as postgres so read tests have a visible row.
insert into
  public.deposit_instances (id, settlement_id, deposit_type_id, name, status)
values
  (
    '37000000-0000-0000-0000-000000000001',
    '34000000-0000-0000-0000-000000000001',
    '36000000-0000-0000-0000-000000000001',
    'DI Iron Mine',
    'active'
  );

-- ===========================================================================
-- ANONYMOUS: cannot read deposit_instances
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
        public.deposit_instances
    ),
    0,
    'anon cannot read deposit_instances'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: cannot read private-world instances
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"31000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.deposit_instances di
        join public.settlements s on s.id = di.settlement_id
        join public.nations n on n.id = s.nation_id
      where
        n.world_id = '32000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read deposit_instances in an inaccessible private world'
  );

reset role;

-- ===========================================================================
-- WORLD OWNER: can read instances in their world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"31000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.deposit_instances
      where
        id = '37000000-0000-0000-0000-000000000001'
    ),
    'world owner can read deposit_instances in their world'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: can insert, update, and delete
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"31000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.deposit_instances (id, settlement_id, deposit_type_id, name, status)
    values (
      '37000000-0000-0000-0000-000000000010',
      '34000000-0000-0000-0000-000000000001',
      '36000000-0000-0000-0000-000000000001',
      'Admin Iron Mine',
      'active'
    )
  $test$,
    'world admin can insert a deposit instance'
  );

select
  lives_ok (
    $test$
    update public.deposit_instances
    set status = 'depleted'
    where id = '37000000-0000-0000-0000-000000000010'
  $test$,
    'world admin can update a deposit instance'
  );

select
  lives_ok (
    $test$
    delete from public.deposit_instances
    where id = '37000000-0000-0000-0000-000000000010'
  $test$,
    'world admin can delete a deposit instance'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: can insert instances in any world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"31000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  lives_ok (
    $test$
    insert into public.deposit_instances (id, settlement_id, deposit_type_id, name, status)
    values (
      '37000000-0000-0000-0000-000000000011',
      '34000000-0000-0000-0000-000000000001',
      '36000000-0000-0000-0000-000000000001',
      'Super Iron Mine',
      'active'
    )
  $test$,
    'super admin can insert a deposit instance'
  );

reset role;

-- ===========================================================================
-- NATION MANAGER: direct write denied
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"31000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.deposit_instances (settlement_id, deposit_type_id, name, status)
    values (
      '34000000-0000-0000-0000-000000000001',
      '36000000-0000-0000-0000-000000000001',
      'Nation Mgr Mine',
      'active'
    )
  $test$,
    '42501',
    null,
    'nation manager cannot directly insert deposit_instances rows'
  );

reset role;

-- ===========================================================================
-- SETTLEMENT MANAGER: direct write denied
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"31000000-0000-0000-0000-000000000006","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.deposit_instances (settlement_id, deposit_type_id, name, status)
    values (
      '34000000-0000-0000-0000-000000000001',
      '36000000-0000-0000-0000-000000000001',
      'Settlement Mgr Mine',
      'active'
    )
  $test$,
    '42501',
    null,
    'settlement manager cannot directly insert deposit_instances rows'
  );

reset role;

-- ===========================================================================
-- CROSS-WORLD: outsider cannot write instances for settlements outside their world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"31000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.deposit_instances (settlement_id, deposit_type_id, name, status)
    values (
      '34000000-0000-0000-0000-000000000001',
      '36000000-0000-0000-0000-000000000001',
      'Cross World Mine',
      'active'
    )
  $test$,
    '42501',
    null,
    'outsider cannot insert deposit_instances for a settlement in another world'
  );

reset role;

-- ===========================================================================
-- CONSTRAINT: max_workers = 0 is rejected by the check constraint
-- Run as postgres to isolate the constraint from RLS.
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.deposit_instances (settlement_id, deposit_type_id, name, status, max_workers)
    values (
      '34000000-0000-0000-0000-000000000001',
      '36000000-0000-0000-0000-000000000001',
      'Zero Workers Mine',
      'active',
      0
    )
  $test$,
    '23514',
    null,
    'max_workers = 0 is rejected by the check constraint'
  );

select
  *
from
  finish ();

rollback;
