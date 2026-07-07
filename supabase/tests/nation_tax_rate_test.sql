-- pgTAP tests for nations.tax_rate bounds and set_nation_tax_rate RPC
-- authority. Run with: npx supabase test db
begin;

select
  plan (8);

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
    'e1000000-0000-0000-0000-000000000001',
    'tax-admin@example.com',
    'x',
    now(),
    '{"username":"tax_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'tax-manager@example.com',
    'x',
    now(),
    '{"username":"tax_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'tax-outsider@example.com',
    'x',
    now(),
    '{"username":"tax_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status, archived_at)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'Tax World',
    'private',
    'active',
    null
  ),
  (
    'e2000000-0000-0000-0000-000000000002',
    'Tax Archived World',
    'private',
    'archived',
    now()
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001'
  ),
  (
    'e2000000-0000-0000-0000-000000000002',
    'e1000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name, is_hidden)
values
  (
    'e3000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'Tax Nation',
    false
  ),
  (
    'e3000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000002',
    'Archived Tax Nation',
    false
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'e4000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    'Tax Nation Settlement'
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
    'e5000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'player_character',
    'Tax Manager',
    'alive',
    'e1000000-0000-0000-0000-000000000002',
    'nation_manager',
    'e3000000-0000-0000-0000-000000000001'
  );

-- ===========================================================================
-- COLUMN: tax_rate defaults to 0.
-- ===========================================================================
select
  is (
    (
      select
        tax_rate
      from
        public.nations
      where
        id = 'e3000000-0000-0000-0000-000000000001'
    ),
    0::numeric,
    'tax_rate defaults to 0'
  );

-- ===========================================================================
-- CONSTRAINT: tax_rate above 0.5 is rejected.
-- ===========================================================================
select
  throws_ok (
    $test$
    update public.nations
    set tax_rate = 0.51
    where id = 'e3000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'tax_rate above 0.5 is rejected'
  );

-- ===========================================================================
-- CONSTRAINT: negative tax_rate is rejected.
-- ===========================================================================
select
  throws_ok (
    $test$
    update public.nations
    set tax_rate = -0.01
    where id = 'e3000000-0000-0000-0000-000000000001'
  $test$,
    '23514',
    null,
    'negative tax_rate is rejected'
  );

-- ===========================================================================
-- RPC: outsider (no manage authority) cannot set tax rate.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_nation_tax_rate(
      'e3000000-0000-0000-0000-000000000001'::uuid,
      0.2
    )
  $test$,
    '42501',
    null,
    'outsider cannot set nation tax rate'
  );

reset role;

-- ===========================================================================
-- RPC: nation manager can set a valid tax rate.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  public.set_nation_tax_rate (
    'e3000000-0000-0000-0000-000000000001'::uuid,
    0.25
  );

reset role;

select
  is (
    (
      select
        tax_rate
      from
        public.nations
      where
        id = 'e3000000-0000-0000-0000-000000000001'
    ),
    0.25::numeric,
    'nation manager can set the tax rate via the RPC'
  );

-- ===========================================================================
-- RPC: world admin can set the tax rate too.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  public.set_nation_tax_rate ('e3000000-0000-0000-0000-000000000001'::uuid, 0.5);

reset role;

select
  is (
    (
      select
        tax_rate
      from
        public.nations
      where
        id = 'e3000000-0000-0000-0000-000000000001'
    ),
    0.5::numeric,
    'world admin can set the tax rate to the upper bound (0.5) via the RPC'
  );

-- ===========================================================================
-- RPC: invalid rate rejected even for an authorized caller.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_nation_tax_rate(
      'e3000000-0000-0000-0000-000000000001'::uuid,
      0.75
    )
  $test$,
    '23514',
    null,
    'an authorized caller cannot set an out-of-range tax rate'
  );

reset role;

-- ===========================================================================
-- RPC: archived worlds are read-only.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_nation_tax_rate(
      'e3000000-0000-0000-0000-000000000002'::uuid,
      0.1
    )
  $test$,
    '22023',
    'Archived worlds are read-only.',
    'archived worlds reject tax rate changes'
  );

reset role;

select
  *
from
  finish ();

rollback;
