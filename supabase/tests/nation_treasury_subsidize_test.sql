-- pgTAP tests for public.subsidize_construction_project: authority, project
-- ownership, and clamp-to-available / clamp-to-storage-cap behavior across
-- multiple input resources.
-- Run with: npx supabase test db
begin;

select
  plan (19);

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
    'subsidy-admin@example.com',
    'x',
    now(),
    '{"username":"subsidy_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000002',
    'subsidy-manager@example.com',
    'x',
    now(),
    '{"username":"subsidy_manager"}'::jsonb,
    now(),
    now()
  ),
  (
    'd1000000-0000-0000-0000-000000000003',
    'subsidy-outsider@example.com',
    'x',
    now(),
    '{"username":"subsidy_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status, archived_at)
values
  (
    'd2000000-0000-0000-0000-000000000001',
    'Subsidy World',
    'private',
    'active',
    null
  ),
  (
    'd2000000-0000-0000-0000-000000000002',
    'Subsidy Archived World',
    'private',
    'archived',
    now()
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'd2000000-0000-0000-0000-000000000001',
    'd1000000-0000-0000-0000-000000000001'
  ),
  (
    'd2000000-0000-0000-0000-000000000002',
    'd1000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'd3000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'Subsidy Nation'
  ),
  (
    'd3000000-0000-0000-0000-000000000002',
    'd2000000-0000-0000-0000-000000000002',
    'Archived Subsidy Nation'
  ),
  (
    'd3000000-0000-0000-0000-000000000003',
    'd2000000-0000-0000-0000-000000000001',
    'Other Subsidy Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'd4000000-0000-0000-0000-000000000001',
    'd3000000-0000-0000-0000-000000000001',
    'Subsidy Nation Settlement'
  ),
  (
    'd4000000-0000-0000-0000-000000000002',
    'd3000000-0000-0000-0000-000000000003',
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
    'd5000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'd4000000-0000-0000-0000-000000000001',
    'player_character',
    'Subsidy Manager',
    'alive',
    'd1000000-0000-0000-0000-000000000002',
    'nation_manager',
    'd3000000-0000-0000-0000-000000000001'
  );

insert into
  public.resources (id, world_id, name, slug, base_stockpile_cap)
values
  (
    'd6000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'Subsidy Stone',
    'subsidy-stone',
    1000
  ),
  (
    'd6000000-0000-0000-0000-000000000002',
    'd2000000-0000-0000-0000-000000000001',
    'Subsidy Iron',
    'subsidy-iron',
    50
  );

insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'd7000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'Subsidy Blueprint',
    'subsidy-blueprint'
  );

insert into
  public.building_blueprint_tiers (
    id,
    building_blueprint_id,
    tier_number,
    worker_turns_required,
    construction_costs_json
  )
values
  (
    'd8000000-0000-0000-0000-000000000001',
    'd7000000-0000-0000-0000-000000000001',
    1,
    10,
    jsonb_build_array(
      jsonb_build_object(
        'resource_id',
        'd6000000-0000-0000-0000-000000000001',
        'amount',
        20
      ),
      jsonb_build_object(
        'resource_id',
        'd6000000-0000-0000-0000-000000000002',
        'amount',
        30
      )
    )
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
    'd9000000-0000-0000-0000-000000000001',
    'd4000000-0000-0000-0000-000000000001',
    'd7000000-0000-0000-0000-000000000001',
    'd8000000-0000-0000-0000-000000000001',
    'queued',
    1
  ),
  (
    'd9000000-0000-0000-0000-000000000002',
    'd4000000-0000-0000-0000-000000000002',
    'd7000000-0000-0000-0000-000000000001',
    'd8000000-0000-0000-0000-000000000001',
    'queued',
    1
  ),
  (
    'd9000000-0000-0000-0000-000000000004',
    'd4000000-0000-0000-0000-000000000001',
    'd7000000-0000-0000-0000-000000000001',
    'd8000000-0000-0000-0000-000000000001',
    'queued',
    2
  );

-- Seed triggers populate zero-quantity stockpile rows; seed explicit balances.
update public.nation_resource_stockpiles
set
  quantity = 100
where
  nation_id = 'd3000000-0000-0000-0000-000000000001'
  and resource_id in (
    'd6000000-0000-0000-0000-000000000001',
    'd6000000-0000-0000-0000-000000000002'
  );

-- ===========================================================================
-- RPC: outsider (no manage authority) cannot subsidize.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.subsidize_construction_project(
      'd3000000-0000-0000-0000-000000000001'::uuid,
      'd9000000-0000-0000-0000-000000000001'::uuid
    )
  $test$,
    '42501',
    null,
    'outsider cannot subsidize a construction project'
  );

reset role;

-- ===========================================================================
-- RPC: project outside the nation's settlements is rejected.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.subsidize_construction_project(
      'd3000000-0000-0000-0000-000000000001'::uuid,
      'd9000000-0000-0000-0000-000000000002'::uuid
    )
  $test$,
    'P0002',
    null,
    'subsidizing a project outside the nation is rejected'
  );

reset role;

-- ===========================================================================
-- RPC: archived worlds are read-only.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.subsidize_construction_project(
      'd3000000-0000-0000-0000-000000000002'::uuid,
      'd9000000-0000-0000-0000-000000000099'::uuid
    )
  $test$,
    '22023',
    'Archived worlds are read-only.',
    'archived worlds reject subsidies'
  );

reset role;

-- ===========================================================================
-- RPC: manager subsidizes a project fully covered by nation stock (no clamp).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}';

create temporary table t_subsidize_ok as
select
  *
from
  public.subsidize_construction_project (
    'd3000000-0000-0000-0000-000000000001'::uuid,
    'd9000000-0000-0000-0000-000000000001'::uuid
  );

reset role;

select
  is (
    (
      select
        count(*)::int
      from
        t_subsidize_ok
    ),
    2,
    'subsidize returns one row per required input resource'
  );

select
  is (
    (
      select
        granted_quantity
      from
        t_subsidize_ok
      where
        resource_id = 'd6000000-0000-0000-0000-000000000001'
    ),
    20::numeric,
    'subsidize grants the full required amount of the first input'
  );

select
  is (
    (
      select
        clamped
      from
        t_subsidize_ok
      where
        resource_id = 'd6000000-0000-0000-0000-000000000001'
    ),
    false,
    'first input is not clamped when nation stock and storage space suffice'
  );

select
  is (
    (
      select
        granted_quantity
      from
        t_subsidize_ok
      where
        resource_id = 'd6000000-0000-0000-0000-000000000002'
    ),
    30::numeric,
    'subsidize grants the full required amount of the second input'
  );

select
  is (
    (
      select
        clamped
      from
        t_subsidize_ok
      where
        resource_id = 'd6000000-0000-0000-0000-000000000002'
    ),
    false,
    'second input is not clamped when nation stock and storage space suffice'
  );

select
  is (
    (
      select
        quantity
      from
        public.nation_resource_stockpiles
      where
        nation_id = 'd3000000-0000-0000-0000-000000000001'
        and resource_id = 'd6000000-0000-0000-0000-000000000001'
    ),
    80::numeric,
    'nation stockpile debited by the first input''s granted quantity'
  );

select
  is (
    (
      select
        quantity
      from
        public.nation_resource_stockpiles
      where
        nation_id = 'd3000000-0000-0000-0000-000000000001'
        and resource_id = 'd6000000-0000-0000-0000-000000000002'
    ),
    70::numeric,
    'nation stockpile debited by the second input''s granted quantity'
  );

select
  is (
    (
      select
        quantity
      from
        public.settlement_resource_stockpiles
      where
        settlement_id = 'd4000000-0000-0000-0000-000000000001'
        and resource_id = 'd6000000-0000-0000-0000-000000000001'
    ),
    20::numeric,
    'project settlement credited with the first input''s granted quantity'
  );

select
  is (
    (
      select
        quantity
      from
        public.settlement_resource_stockpiles
      where
        settlement_id = 'd4000000-0000-0000-0000-000000000001'
        and resource_id = 'd6000000-0000-0000-0000-000000000002'
    ),
    30::numeric,
    'project settlement credited with the second input''s granted quantity'
  );

-- ===========================================================================
-- RPC: subsidize clamps to nation stock AND to settlement storage space
-- independently per resource, on a second project in the same settlement.
-- Nation now has 80/70 remaining; drain the first input to force a stock
-- clamp, and rely on the settlement already sitting at 30/50 of the second
-- input (storage cap 50) to force a storage-space clamp.
-- ===========================================================================
update public.nation_resource_stockpiles
set
  quantity = 5
where
  nation_id = 'd3000000-0000-0000-0000-000000000001'
  and resource_id = 'd6000000-0000-0000-0000-000000000001';

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"d1000000-0000-0000-0000-000000000002","role":"authenticated"}';

create temporary table t_subsidize_clamped as
select
  *
from
  public.subsidize_construction_project (
    'd3000000-0000-0000-0000-000000000001'::uuid,
    'd9000000-0000-0000-0000-000000000004'::uuid
  );

reset role;

select
  is (
    (
      select
        count(*)::int
      from
        t_subsidize_clamped
    ),
    2,
    'clamped subsidize still returns one row per required input resource'
  );

select
  is (
    (
      select
        granted_quantity
      from
        t_subsidize_clamped
      where
        resource_id = 'd6000000-0000-0000-0000-000000000001'
    ),
    5::numeric,
    'first input clamps to the nation''s remaining stock'
  );

select
  is (
    (
      select
        clamped
      from
        t_subsidize_clamped
      where
        resource_id = 'd6000000-0000-0000-0000-000000000001'
    ),
    true,
    'first input is reported as clamped by remaining stock'
  );

select
  is (
    (
      select
        granted_quantity
      from
        t_subsidize_clamped
      where
        resource_id = 'd6000000-0000-0000-0000-000000000002'
    ),
    20::numeric,
    'second input clamps to the settlement''s remaining storage space'
  );

select
  is (
    (
      select
        clamped
      from
        t_subsidize_clamped
      where
        resource_id = 'd6000000-0000-0000-0000-000000000002'
    ),
    true,
    'second input is reported as clamped by storage space'
  );

select
  is (
    (
      select
        quantity
      from
        public.nation_resource_stockpiles
      where
        nation_id = 'd3000000-0000-0000-0000-000000000001'
        and resource_id = 'd6000000-0000-0000-0000-000000000001'
    ),
    0::numeric,
    'nation stockpile never goes negative on the first input'
  );

select
  is (
    (
      select
        quantity
      from
        public.settlement_resource_stockpiles
      where
        settlement_id = 'd4000000-0000-0000-0000-000000000001'
        and resource_id = 'd6000000-0000-0000-0000-000000000002'
    ),
    50::numeric,
    'settlement stockpile never exceeds its effective storage cap on the second input'
  );

select
  *
from
  finish ();

rollback;
