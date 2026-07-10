-- pgTAP tests for public.construction_project_subsidies RLS.
-- Run with: npx supabase test db
begin;

select
  plan (7);

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
    'ledger-admin@example.com',
    'x',
    now(),
    '{"username":"ledger_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'ledger-pc@example.com',
    'x',
    now(),
    '{"username":"ledger_pc"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'ledger-outsider@example.com',
    'x',
    now(),
    '{"username":"ledger_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'Ledger Private World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'e1000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'e3000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'Ledger Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'e4000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    'Ledger Settlement'
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
    role_type
  )
values
  (
    'e5000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'player_character',
    'Ledger PC',
    'alive',
    'e1000000-0000-0000-0000-000000000002',
    'none'
  );

insert into
  public.resources (id, world_id, name, slug)
values
  (
    'e6000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'Ledger Stone',
    'ledger-stone'
  );

insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'e7000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'Ledger Blueprint',
    'ledger-blueprint'
  );

insert into
  public.building_blueprint_tiers (
    id,
    building_blueprint_id,
    tier_number,
    worker_turns_required
  )
values
  (
    'e8000000-0000-0000-0000-000000000001',
    'e7000000-0000-0000-0000-000000000001',
    1,
    10
  );

insert into
  public.construction_projects (
    id,
    settlement_id,
    building_blueprint_id,
    target_tier_id,
    status,
    queue_position
  )
values
  (
    'e9000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'e7000000-0000-0000-0000-000000000001',
    'e8000000-0000-0000-0000-000000000001',
    'queued',
    1
  );

-- Inserted as postgres (bypasses RLS -- there is no authenticated insert
-- policy on this table by design, see the migration).
insert into
  public.construction_project_subsidies (
    id,
    project_id,
    nation_id,
    settlement_id,
    resource_id,
    granted_quantity,
    clamped
  )
values
  (
    'ea000000-0000-0000-0000-000000000001',
    'e9000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'e6000000-0000-0000-0000-000000000001',
    20,
    false
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
        public.construction_project_subsidies
    ),
    0,
    'anon cannot read construction_project_subsidies'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: cannot read subsidy rows in an inaccessible private world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.construction_project_subsidies
      where
        id = 'ea000000-0000-0000-0000-000000000001'
    ),
    0,
    'outsider cannot read subsidy rows in an inaccessible private world'
  );

select
  throws_ok (
    $test$
    insert into public.construction_project_subsidies (
      project_id, nation_id, settlement_id, resource_id, granted_quantity
    ) values (
      'e9000000-0000-0000-0000-000000000001',
      'e3000000-0000-0000-0000-000000000001',
      'e4000000-0000-0000-0000-000000000001',
      'e6000000-0000-0000-0000-000000000001',
      5
    )
  $test$,
    '42501',
    null,
    'outsider cannot directly insert a subsidy ledger row'
  );

reset role;

-- ===========================================================================
-- PC HOLDER: player character in the world can read subsidy history
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.construction_project_subsidies
      where
        id = 'ea000000-0000-0000-0000-000000000001'
    ),
    'player character in the world can read subsidy history'
  );

select
  throws_ok (
    $test$
    insert into public.construction_project_subsidies (
      project_id, nation_id, settlement_id, resource_id, granted_quantity
    ) values (
      'e9000000-0000-0000-0000-000000000001',
      'e3000000-0000-0000-0000-000000000001',
      'e4000000-0000-0000-0000-000000000001',
      'e6000000-0000-0000-0000-000000000001',
      5
    )
  $test$,
    '42501',
    null,
    'player character cannot directly insert a subsidy ledger row (RPC-only writes)'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: can read subsidy history in the administered world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.construction_project_subsidies
      where
        id = 'ea000000-0000-0000-0000-000000000001'
    ),
    'world admin can read subsidy history in the administered world'
  );

select
  throws_ok (
    $test$
    insert into public.construction_project_subsidies (
      project_id, nation_id, settlement_id, resource_id, granted_quantity
    ) values (
      'e9000000-0000-0000-0000-000000000001',
      'e3000000-0000-0000-0000-000000000001',
      'e4000000-0000-0000-0000-000000000001',
      'e6000000-0000-0000-0000-000000000001',
      5
    )
  $test$,
    '42501',
    null,
    'world admin cannot directly insert a subsidy ledger row either (RPC-only writes)'
  );

reset role;

select
  *
from
  finish ();

rollback;
