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
  public.worlds (id, name, visibility, status, current_turn_number)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'Directory World',
    'private',
    'active',
    10
  ),
  (
    'e2000000-0000-0000-0000-000000000002',
    'Directory World Other',
    'private',
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
    office_type,
    citizen_id,
    appointed_turn_number
  )
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-000000000001',
    'treasurer',
    'e5000000-0000-0000-0000-000000000002',
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
    3,
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

reset role;

select
  *
from
  finish ();

rollback;
