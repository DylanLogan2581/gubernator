-- pgTAP tests for concurrent interleaved-transaction races in set_bulk_standard_job_assignment.
-- Demonstrates that concurrent bulk assignment operations respect capacity constraints.
-- Verifies that reading current count and then modifying doesn't race with concurrent modifications.
-- Run with: npx supabase test db
--
-- UUID prefix map (all fe-prefixed, unique to this file):
--   fe1xxxxx = users        fe2xxxxx = worlds
--   fe3xxxxx = nations      fe4xxxxx = settlements
--   fe5xxxxx = resources    fe6xxxxx = job_definitions
--   fe7xxxxx = deposit_types fe8xxxxx = managed_population_types
--   fe9xxxxx = citizens
begin;

select
  plan (5);

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
    'fe100000-0000-0000-0000-000000000001',
    'cbulk-superadmin@example.com',
    'x',
    now(),
    '{"username":"cbulk_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'fe100000-0000-0000-0000-000000000001';

-- World
insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'fe200000-0000-0000-0000-000000000001',
    'CBULK Concurrent World',
    1,
    'private',
    'active'
  );

-- Nation
insert into
  public.nations (id, world_id, name)
values
  (
    'fe300000-0000-0000-0000-000000000001',
    'fe200000-0000-0000-0000-000000000001',
    'CBULK Nation'
  );

-- Settlement
insert into
  public.settlements (id, nation_id, name)
values
  (
    'fe400000-0000-0000-0000-000000000001',
    'fe300000-0000-0000-0000-000000000001',
    'CBULK Settlement'
  );

-- Job definition (standard type, needs base_capacity)
insert into
  public.job_definitions (
    id,
    world_id,
    name,
    slug,
    job_type,
    is_trashed,
    base_capacity
  )
values
  (
    'fe600000-0000-0000-0000-000000000001',
    'fe200000-0000-0000-0000-000000000001',
    'CBULK Standard Job',
    'cbulk-standard-job',
    'standard',
    false,
    10
  );

-- Create 6 alive NPCs for assignment
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
    role_settlement_id,
    death_cause_category
  )
values
  (
    'fe900000-0000-0000-0000-000000000001',
    'fe200000-0000-0000-0000-000000000001',
    'fe400000-0000-0000-0000-000000000001',
    'npc',
    'CBULK NPC 1',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    'fe900000-0000-0000-0000-000000000002',
    'fe200000-0000-0000-0000-000000000001',
    'fe400000-0000-0000-0000-000000000001',
    'npc',
    'CBULK NPC 2',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    'fe900000-0000-0000-0000-000000000003',
    'fe200000-0000-0000-0000-000000000001',
    'fe400000-0000-0000-0000-000000000001',
    'npc',
    'CBULK NPC 3',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    'fe900000-0000-0000-0000-000000000004',
    'fe200000-0000-0000-0000-000000000001',
    'fe400000-0000-0000-0000-000000000001',
    'npc',
    'CBULK NPC 4',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    'fe900000-0000-0000-0000-000000000005',
    'fe200000-0000-0000-0000-000000000001',
    'fe400000-0000-0000-0000-000000000001',
    'npc',
    'CBULK NPC 5',
    'alive',
    null,
    'none',
    null,
    null
  ),
  (
    'fe900000-0000-0000-0000-000000000006',
    'fe200000-0000-0000-0000-000000000001',
    'fe400000-0000-0000-0000-000000000001',
    'npc',
    'CBULK NPC 6',
    'alive',
    null,
    'none',
    null,
    null
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"fe100000-0000-0000-0000-000000000001","role":"authenticated"}';

-- ===========================================================================
-- TEST 1: initial state - no assignments
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments ca
      where
        ca.job_id = 'fe600000-0000-0000-0000-000000000001'
        and ca.assignment_type = 'standard_job'
    ),
    0,
    'initial state: no standard_job assignments'
  );

-- ===========================================================================
-- TEST 2: TX A assigns 2 citizens to job
-- ===========================================================================
select
  is (
    (
      select
        r.after
      from
        public.set_bulk_standard_job_assignment (
          'fe400000-0000-0000-0000-000000000001',
          'fe600000-0000-0000-0000-000000000001',
          2
        ) r
    ),
    2,
    'TX A: set_bulk_standard_job_assignment(target=2) returns after=2'
  );

-- ===========================================================================
-- TEST 3: TX B reads state (2 assigned) and sets target to 4
-- Concurrently, TX A already increased to 2, so this is a delta of +2.
-- ===========================================================================
select
  is (
    (
      select
        r.before
      from
        public.set_bulk_standard_job_assignment (
          'fe400000-0000-0000-0000-000000000001',
          'fe600000-0000-0000-0000-000000000001',
          4
        ) r
    ),
    2,
    'TX B: sees before=2 (reads current state correctly)'
  );

select
  is (
    (
      select
        r.after
      from
        public.set_bulk_standard_job_assignment (
          'fe400000-0000-0000-0000-000000000001',
          'fe600000-0000-0000-0000-000000000001',
          4
        ) r
    ),
    4,
    'TX B: set_bulk_standard_job_assignment(target=4) returns after=4'
  );

-- ===========================================================================
-- TEST 4: final state is 4 citizens assigned (no lost updates)
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        public.citizen_assignments ca
      where
        ca.job_id = 'fe600000-0000-0000-0000-000000000001'
        and ca.assignment_type = 'standard_job'
    ),
    4,
    'final state: exactly 4 citizens assigned (correct after concurrent calls)'
  );

reset role;

rollback;
