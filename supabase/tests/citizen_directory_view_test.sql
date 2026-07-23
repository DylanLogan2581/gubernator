-- pgTAP tests for public.citizen_directory_view (#989).
-- Run with: npx supabase test db
--
-- The view is security_invoker, so row/column visibility is inherited
-- straight from citizens_select_visible (20260817000000) and the citizens
-- column-level grants (20260611000003) — this file only proves the view
-- carries that inheritance through correctly and that its computed columns
-- (settlement/nation name, age_turns, assignment_label) resolve correctly.
-- Full visibility-matrix coverage (nation/settlement manager scoping etc.)
-- already lives in citizens_rls_test.sql.
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
    'e1000000-0000-0000-0000-000000000001',
    'directory-admin@example.com',
    'x',
    now(),
    '{"username":"directory_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'directory-pc-holder@example.com',
    'x',
    now(),
    '{"username":"directory_pc_holder"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'directory-unrelated@example.com',
    'x',
    now(),
    '{"username":"directory_unrelated"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000004',
    'directory-superadmin@example.com',
    'x',
    now(),
    '{"username":"directory_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'e1000000-0000-0000-0000-000000000004';

insert into
  public.worlds (id, name, status, current_turn_number)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'Directory World',
    'active',
    10
  ),
  (
    'e2000000-0000-0000-0000-000000000002',
    'Directory World Other',
    'active',
    10
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
    'Directory Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'e4000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    'Directory Settlement'
  );

insert into
  public.job_definitions (id, world_id, name, slug, job_type, base_capacity)
values
  (
    'e6000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'Blacksmith',
    'directory-blacksmith',
    'standard',
    10
  );

insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    sex,
    born_on_turn_number,
    user_id,
    death_cause,
    death_cause_category
  )
values
  (
    'e5000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'player_character',
    'Directory PC',
    'alive',
    'female',
    3,
    'e1000000-0000-0000-0000-000000000002',
    null,
    null
  ),
  (
    'e5000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'npc',
    'Directory NPC Worker',
    'alive',
    'male',
    1,
    null,
    null,
    null
  ),
  (
    'e5000000-0000-0000-0000-000000000003',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'npc',
    'Directory NPC Deceased',
    'dead',
    'male',
    null,
    null,
    'unknown causes',
    'unknown'
  ),
  (
    'e5000000-0000-0000-0000-000000000004',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'npc',
    'Directory NPC Student',
    'alive',
    'female',
    1,
    null,
    null,
    null
  ),
  (
    'e5000000-0000-0000-0000-000000000005',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'npc',
    'Directory NPC Soldier',
    'alive',
    'male',
    1,
    null,
    null,
    null
  ),
  (
    'e5000000-0000-0000-0000-000000000006',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'npc',
    'Directory NPC Labor Officeholder',
    'alive',
    'male',
    1,
    null,
    null,
    null
  );

insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    job_id,
    assigned_on_turn_number
  )
values
  (
    'e5000000-0000-0000-0000-000000000002',
    'standard_job',
    'e6000000-0000-0000-0000-000000000001',
    1
  );

insert into
  public.nation_offices (
    world_id,
    nation_id,
    office_type_id,
    citizen_id,
    appointed_turn_number
  )
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    (
      select
        id
      from
        public.office_types
      where
        world_id = 'e2000000-0000-0000-0000-000000000001'
        and nation_id is null
        and name = 'treasurer'
    ),
    'e5000000-0000-0000-0000-000000000002',
    1
  );

-- ---------------------------------------------------------------------------
-- #1322 labor-eligibility fixtures: an education enrollment, a soldier, and
-- a custom office type that does NOT exclude from labor (to distinguish
-- is_labor_excluded_officeholder from merely holding office_types).
-- ---------------------------------------------------------------------------
insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'e7000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'Directory Schoolhouse',
    'directory-schoolhouse'
  );

insert into
  public.building_blueprint_tiers (
    id,
    building_blueprint_id,
    tier_number,
    effects_json
  )
values
  (
    'e7100000-0000-0000-0000-000000000001',
    'e7000000-0000-0000-0000-000000000001',
    1,
    '[]'::jsonb
  );

insert into
  public.settlement_buildings (
    id,
    settlement_id,
    building_blueprint_id,
    current_tier_id,
    state,
    activated_on_turn_number
  )
values
  (
    'e7200000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-000000000001',
    'e7000000-0000-0000-0000-000000000001',
    'e7100000-0000-0000-0000-000000000001',
    'active',
    1
  );

insert into
  public.education_levels (id, world_id, name, rank)
values
  (
    'e8000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'Directory Basic',
    1
  );

insert into
  public.education_enrollments (
    world_id,
    settlement_building_id,
    citizen_id,
    target_level_id,
    enrolled_turn_number
  )
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'e7200000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000004',
    'e8000000-0000-0000-0000-000000000001',
    1
  );

insert into
  public.unit_types (
    id,
    world_id,
    name,
    soldiers_per_unit,
    desertion_rate
  )
values
  (
    'e9000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'Directory Militia',
    10,
    0.05
  );

insert into
  public.armies (
    id,
    world_id,
    nation_id,
    name,
    funding_source,
    stationed_settlement_id,
    created_turn_number
  )
values
  (
    'e9100000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    'Directory Army',
    'nation',
    'e4000000-0000-0000-0000-000000000001',
    1
  );

insert into
  public.army_units (
    id,
    army_id,
    unit_type_id,
    name,
    created_turn_number
  )
values
  (
    'e9200000-0000-0000-0000-000000000001',
    'e9100000-0000-0000-0000-000000000001',
    'e9000000-0000-0000-0000-000000000001',
    'Directory Unit',
    1
  );

insert into
  public.unit_soldiers (
    world_id,
    unit_id,
    citizen_id,
    recruited_turn_number
  )
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'e9200000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000005',
    1
  );

insert into
  public.office_types (
    id,
    world_id,
    nation_id,
    name,
    scope,
    excludes_from_labor
  )
values
  (
    'ea000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    null,
    'directory_labor_neutral_office',
    'nation',
    false
  );

insert into
  public.nation_offices (
    world_id,
    nation_id,
    office_type_id,
    citizen_id,
    appointed_turn_number
  )
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    'ea000000-0000-0000-0000-000000000001',
    'e5000000-0000-0000-0000-000000000006',
    1
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
        public.citizen_directory_view
      where
        world_id = 'e2000000-0000-0000-0000-000000000001'
    ),
    0,
    'anon cannot read the citizen directory view'
  );

reset role;

-- ===========================================================================
-- UNRELATED AUTHENTICATED USER: no PC and no admin role in this world
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
        public.citizen_directory_view
      where
        world_id = 'e2000000-0000-0000-0000-000000000001'
    ),
    0,
    'unrelated authenticated user cannot read the citizen directory view'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: sees every citizen row, with joined names and labels resolved
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_directory_view
      where
        world_id = 'e2000000-0000-0000-0000-000000000001'
    ),
    6,
    'world admin can read every citizen row in the directory view'
  );

select
  is (
    (
      select
        settlement_name || ' / ' || nation_name
      from
        public.citizen_directory_view
      where
        id = 'e5000000-0000-0000-0000-000000000001'
    ),
    'Directory Settlement / Directory Nation',
    'directory view resolves settlement_name and nation_name'
  );

select
  is (
    (
      select
        age_turns
      from
        public.citizen_directory_view
      where
        id = 'e5000000-0000-0000-0000-000000000001'
    ),
    7,
    'directory view computes age_turns from world.current_turn_number - born_on_turn_number'
  );

select
  is (
    (
      select
        assignment_label
      from
        public.citizen_directory_view
      where
        id = 'e5000000-0000-0000-0000-000000000002'
    ),
    'Blacksmith',
    'directory view resolves assignment_label for a standard_job assignment'
  );

select
  is (
    (
      select
        assignment_label
      from
        public.citizen_directory_view
      where
        id = 'e5000000-0000-0000-0000-000000000003'
    ),
    null,
    'directory view leaves assignment_label null for an unassigned citizen'
  );

select
  throws_ok (
    $test$
    select
      personality_text
    from
      public.citizen_directory_view
    $test$,
    '42703',
    null,
    'directory view does not expose the NPC-flavor columns at all'
  );

select
  is (
    (
      select
        office_types
      from
        public.citizen_directory_view
      where
        id = 'e5000000-0000-0000-0000-000000000002'
    ),
    'treasurer',
    'directory view resolves office_types for a citizen holding a nation office'
  );

select
  is (
    (
      select
        office_types
      from
        public.citizen_directory_view
      where
        id = 'e5000000-0000-0000-0000-000000000001'
    ),
    null,
    'directory view leaves office_types null for a citizen holding no office'
  );

-- ---------------------------------------------------------------------------
-- #1322: is_labor_excluded_officeholder / is_enrolled_in_education /
-- is_soldier -- the labor-eligibility flags used to correct the settlement
-- assignment board's unassigned count.
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        is_labor_excluded_officeholder
      from
        public.citizen_directory_view
      where
        id = 'e5000000-0000-0000-0000-000000000002'
    ),
    true,
    'directory view marks a treasurer (excludes_from_labor office) as a labor-excluded officeholder'
  );

select
  is (
    (
      select
        office_types
      from
        public.citizen_directory_view
      where
        id = 'e5000000-0000-0000-0000-000000000006'
    ),
    'directory_labor_neutral_office',
    'directory view still resolves office_types for a non-labor-excluding office'
  );

select
  is (
    (
      select
        is_labor_excluded_officeholder
      from
        public.citizen_directory_view
      where
        id = 'e5000000-0000-0000-0000-000000000006'
    ),
    false,
    'directory view leaves is_labor_excluded_officeholder false for an office that does not exclude from labor'
  );

select
  is (
    (
      select
        is_enrolled_in_education
      from
        public.citizen_directory_view
      where
        id = 'e5000000-0000-0000-0000-000000000004'
    ),
    true,
    'directory view marks an education enrollee as is_enrolled_in_education'
  );

select
  is (
    (
      select
        is_soldier
      from
        public.citizen_directory_view
      where
        id = 'e5000000-0000-0000-0000-000000000005'
    ),
    true,
    'directory view marks a unit_soldiers citizen as is_soldier'
  );

select
  is (
    (
      select
        is_labor_excluded_officeholder
      from
        public.citizen_directory_view
      where
        id = 'e5000000-0000-0000-0000-000000000001'
    ),
    false,
    'directory view leaves is_labor_excluded_officeholder false for a citizen with no office'
  );

select
  is (
    (
      select
        is_enrolled_in_education
      from
        public.citizen_directory_view
      where
        id = 'e5000000-0000-0000-0000-000000000001'
    ),
    false,
    'directory view leaves is_enrolled_in_education false for a citizen with no enrollment'
  );

select
  is (
    (
      select
        is_soldier
      from
        public.citizen_directory_view
      where
        id = 'e5000000-0000-0000-0000-000000000001'
    ),
    false,
    'directory view leaves is_soldier false for a citizen with no unit_soldiers row'
  );

reset role;

select
  *
from
  finish ();

rollback;
