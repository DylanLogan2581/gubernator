-- pgTAP tests for nations.capital_settlement_id / founded_turn_number:
-- same-nation guard trigger, capital clearing on settlement nation reassign,
-- and set_nation_capital_and_founded_turn RPC authority.
-- Run with: npx supabase test db
begin;

select
  plan (10);

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
    '64000000-0000-0000-0000-000000000001',
    'capital-admin@example.com',
    'x',
    now(),
    '{"username":"capital_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '64000000-0000-0000-0000-000000000002',
    'capital-manager@example.com',
    'x',
    now(),
    '{"username":"capital_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    '64000000-0000-0000-0000-000000000003',
    'capital-outsider@example.com',
    'x',
    now(),
    '{"username":"capital_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status, archived_at)
values
  (
    '65000000-0000-0000-0000-000000000001',
    'Capital World',
    'private',
    'active',
    null
  ),
  (
    '65000000-0000-0000-0000-000000000002',
    'Capital Archived World',
    'private',
    'archived',
    now()
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    '65000000-0000-0000-0000-000000000001',
    '64000000-0000-0000-0000-000000000001'
  ),
  (
    '65000000-0000-0000-0000-000000000002',
    '64000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    '66000000-0000-0000-0000-000000000001',
    '65000000-0000-0000-0000-000000000001',
    'Nation A'
  ),
  (
    '66000000-0000-0000-0000-000000000002',
    '65000000-0000-0000-0000-000000000001',
    'Nation B'
  ),
  (
    '66000000-0000-0000-0000-000000000003',
    '65000000-0000-0000-0000-000000000002',
    'Archived Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    '67000000-0000-0000-0000-000000000001',
    '66000000-0000-0000-0000-000000000001',
    'Nation A Settlement'
  ),
  (
    '67000000-0000-0000-0000-000000000002',
    '66000000-0000-0000-0000-000000000002',
    'Nation B Settlement'
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
    '68000000-0000-0000-0000-000000000001',
    '65000000-0000-0000-0000-000000000001',
    '67000000-0000-0000-0000-000000000001',
    'player_character',
    'Nation A Manager',
    'alive',
    '64000000-0000-0000-0000-000000000002',
    'nation_manager',
    '66000000-0000-0000-0000-000000000001'
  );

-- ===========================================================================
-- Columns exist and are nullable.
-- ===========================================================================
select
  is (
    (
      select
        capital_settlement_id
      from
        public.nations
      where
        id = '66000000-0000-0000-0000-000000000001'
    ),
    null::uuid,
    'capital_settlement_id defaults to null'
  );

select
  is (
    (
      select
        founded_turn_number
      from
        public.nations
      where
        id = '66000000-0000-0000-0000-000000000001'
    ),
    null::integer,
    'founded_turn_number defaults to null'
  );

-- ===========================================================================
-- Trigger: capital settlement from another nation is rejected.
-- ===========================================================================
select
  throws_ok (
    $test$
    update public.nations
    set capital_settlement_id = '67000000-0000-0000-0000-000000000002'
    where id = '66000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    'Capital settlement must belong to this nation.',
    'capital settlement from another nation is rejected'
  );

-- ===========================================================================
-- RPC: outsider (no manage authority) cannot set capital / founded turn.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"64000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_nation_capital_and_founded_turn(
      '66000000-0000-0000-0000-000000000001'::uuid,
      '67000000-0000-0000-0000-000000000001'::uuid,
      3
    )
  $test$,
    '42501',
    null,
    'outsider cannot set nation capital / founded turn'
  );

reset role;

-- ===========================================================================
-- RPC: nation manager can set capital and founded turn.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"64000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  public.set_nation_capital_and_founded_turn (
    '66000000-0000-0000-0000-000000000001'::uuid,
    '67000000-0000-0000-0000-000000000001'::uuid,
    5
  );

reset role;

select
  is (
    (
      select
        capital_settlement_id
      from
        public.nations
      where
        id = '66000000-0000-0000-0000-000000000001'
    ),
    '67000000-0000-0000-0000-000000000001'::uuid,
    'nation manager can set the capital settlement'
  );

select
  is (
    (
      select
        founded_turn_number
      from
        public.nations
      where
        id = '66000000-0000-0000-0000-000000000001'
    ),
    5,
    'nation manager can set the founded turn number'
  );

-- ===========================================================================
-- RPC: world admin can clear capital and founded turn.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"64000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  public.set_nation_capital_and_founded_turn (
    '66000000-0000-0000-0000-000000000001'::uuid,
    null,
    null
  );

reset role;

select
  is (
    (
      select
        capital_settlement_id
      from
        public.nations
      where
        id = '66000000-0000-0000-0000-000000000001'
    ),
    null::uuid,
    'world admin can clear the capital settlement'
  );

select
  is (
    (
      select
        founded_turn_number
      from
        public.nations
      where
        id = '66000000-0000-0000-0000-000000000001'
    ),
    null::integer,
    'world admin can clear the founded turn number'
  );

-- ===========================================================================
-- RPC: archived worlds are read-only.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"64000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_nation_capital_and_founded_turn(
      '66000000-0000-0000-0000-000000000003'::uuid,
      null,
      1
    )
  $test$,
    '22023',
    'Archived worlds are read-only.',
    'archived worlds reject nation capital / founded turn changes'
  );

reset role;

-- ===========================================================================
-- Trigger: reassigning a settlement to a different nation clears it as
-- capital on the nation it left.
-- ===========================================================================
select
  public.set_nation_capital_and_founded_turn (
    '66000000-0000-0000-0000-000000000001'::uuid,
    '67000000-0000-0000-0000-000000000001'::uuid,
    5
  );

update public.settlements
set
  nation_id = '66000000-0000-0000-0000-000000000002'
where
  id = '67000000-0000-0000-0000-000000000001';

select
  is (
    (
      select
        capital_settlement_id
      from
        public.nations
      where
        id = '66000000-0000-0000-0000-000000000001'
    ),
    null::uuid,
    'reassigning the capital settlement to another nation clears it as capital'
  );

select
  *
from
  finish ();

rollback;
