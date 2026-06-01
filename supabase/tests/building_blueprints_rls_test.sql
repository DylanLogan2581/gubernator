-- pgTAP tests for public.building_blueprints and public.building_blueprint_tiers.
-- Covers RLS write boundary, cascade delete, and tier uniqueness.
-- Run with: npx supabase test db
begin;

select
  plan (25);

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
    'a1000000-0000-0000-0000-000000000001',
    'bb-owner@example.com',
    'x',
    now(),
    '{"username":"bb_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'a1000000-0000-0000-0000-000000000002',
    'bb-admin@example.com',
    'x',
    now(),
    '{"username":"bb_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'a1000000-0000-0000-0000-000000000003',
    'bb-outsider@example.com',
    'x',
    now(),
    '{"username":"bb_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'a1000000-0000-0000-0000-000000000004',
    'bb-superadmin@example.com',
    'x',
    now(),
    '{"username":"bb_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'a1000000-0000-0000-0000-000000000004';

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    'a2000000-0000-0000-0000-000000000001',
    'BB Private World',
    'a1000000-0000-0000-0000-000000000001',
    'private',
    'active'
  ),
  (
    'a2000000-0000-0000-0000-000000000002',
    'BB Public World',
    'a1000000-0000-0000-0000-000000000001',
    'public',
    'active'
  ),
  (
    'a2000000-0000-0000-0000-000000000003',
    'BB Outsider World',
    'a1000000-0000-0000-0000-000000000003',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'a2000000-0000-0000-0000-000000000001',
    'a1000000-0000-0000-0000-000000000002'
  );

-- Seed a blueprint in the private world for RLS write tests.
insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'a3000000-0000-0000-0000-000000000001',
    'a2000000-0000-0000-0000-000000000001',
    'Farmhouse',
    'farmhouse'
  );

-- Seed a blueprint in the public world for outsider read tests.
insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'a3000000-0000-0000-0000-000000000002',
    'a2000000-0000-0000-0000-000000000002',
    'Fishing Hut',
    'fishing-hut'
  );

-- Seed a tier on the private-world blueprint for cascade delete tests.
insert into
  public.building_blueprint_tiers (
    id,
    building_blueprint_id,
    tier_number,
    worker_turns_required
  )
values
  (
    'a4000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-000000000001',
    1,
    10
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
        public.building_blueprints
    ),
    0,
    'anon cannot read building_blueprints'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.building_blueprint_tiers
    ),
    0,
    'anon cannot read building_blueprint_tiers'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: can read public-world blueprints; cannot read private; cannot write
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.building_blueprints
      where
        world_id = 'a2000000-0000-0000-0000-000000000002'
    ),
    'outsider can read building_blueprints in a public world'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.building_blueprints
      where
        world_id = 'a2000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read building_blueprints in an inaccessible private world'
  );

select
  throws_ok (
    $test$
    insert into public.building_blueprints (world_id, name, slug)
    values (
      'a2000000-0000-0000-0000-000000000001',
      'Outsider Blueprint',
      'outsider-blueprint'
    )
  $test$,
    '42501',
    null,
    'outsider cannot insert building_blueprints into an inaccessible world'
  );

update public.building_blueprints
set
  name = 'Outsider Update'
where
  id = 'a3000000-0000-0000-0000-000000000001';

delete from public.building_blueprints
where
  id = 'a3000000-0000-0000-0000-000000000001';

reset role;

select
  is (
    (
      select
        name
      from
        public.building_blueprints
      where
        id = 'a3000000-0000-0000-0000-000000000001'
    ),
    'Farmhouse',
    'outsider update is silently ignored by RLS'
  );

select
  ok (
    exists (
      select
        1
      from
        public.building_blueprints
      where
        id = 'a3000000-0000-0000-0000-000000000001'
    ),
    'outsider delete is silently ignored by RLS'
  );

-- ===========================================================================
-- OWNER: world owners can manage blueprints and tiers in their world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.building_blueprints
      where
        world_id = 'a2000000-0000-0000-0000-000000000001'
    ),
    'owner can read building_blueprints in their world'
  );

select
  lives_ok (
    $test$
    insert into public.building_blueprints (id, world_id, name, slug)
    values (
      'a3000000-0000-0000-0000-000000000010',
      'a2000000-0000-0000-0000-000000000001',
      'Owner Blueprint',
      'owner-blueprint'
    )
  $test$,
    'owner can insert building_blueprints in their world'
  );

select
  lives_ok (
    $test$
    insert into public.building_blueprint_tiers (
      id, building_blueprint_id, tier_number, worker_turns_required
    )
    values (
      'a4000000-0000-0000-0000-000000000010',
      'a3000000-0000-0000-0000-000000000010',
      1,
      5
    )
  $test$,
    'owner can insert building_blueprint_tiers for their blueprint'
  );

select
  lives_ok (
    $test$
    update public.building_blueprints
    set name = 'Owner Updated'
    where id = 'a3000000-0000-0000-0000-000000000010'
  $test$,
    'owner can update building_blueprints in their world'
  );

select
  lives_ok (
    $test$
    delete from public.building_blueprints
    where id = 'a3000000-0000-0000-0000-000000000010'
  $test$,
    'owner can delete building_blueprints in their world'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: explicit admins can manage blueprints and tiers
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.building_blueprints
      where
        world_id = 'a2000000-0000-0000-0000-000000000001'
    ),
    'world admin can read building_blueprints in the administered world'
  );

select
  lives_ok (
    $test$
    insert into public.building_blueprints (id, world_id, name, slug)
    values (
      'a3000000-0000-0000-0000-000000000011',
      'a2000000-0000-0000-0000-000000000001',
      'Admin Blueprint',
      'admin-blueprint'
    )
  $test$,
    'world admin can insert building_blueprints in the administered world'
  );

select
  lives_ok (
    $test$
    insert into public.building_blueprint_tiers (
      id, building_blueprint_id, tier_number, worker_turns_required
    )
    values (
      'a4000000-0000-0000-0000-000000000011',
      'a3000000-0000-0000-0000-000000000011',
      1,
      8
    )
  $test$,
    'world admin can insert building_blueprint_tiers for their blueprint'
  );

select
  lives_ok (
    $test$
    update public.building_blueprints
    set name = 'Admin Updated'
    where id = 'a3000000-0000-0000-0000-000000000011'
  $test$,
    'world admin can update building_blueprints in the administered world'
  );

select
  lives_ok (
    $test$
    delete from public.building_blueprints
    where id = 'a3000000-0000-0000-0000-000000000011'
  $test$,
    'world admin can delete building_blueprints in the administered world'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: can read and manage blueprints across all worlds
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"a1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.building_blueprints
      where
        world_id in (
          'a2000000-0000-0000-0000-000000000001',
          'a2000000-0000-0000-0000-000000000002',
          'a2000000-0000-0000-0000-000000000003'
        )
    ),
    2,
    'super admin can read building_blueprints across all worlds'
  );

select
  lives_ok (
    $test$
    insert into public.building_blueprints (id, world_id, name, slug)
    values (
      'a3000000-0000-0000-0000-000000000012',
      'a2000000-0000-0000-0000-000000000003',
      'Super Admin Blueprint',
      'super-admin-blueprint'
    )
  $test$,
    'super admin can insert building_blueprints in any world'
  );

select
  lives_ok (
    $test$
    insert into public.building_blueprint_tiers (
      id, building_blueprint_id, tier_number, worker_turns_required
    )
    values (
      'a4000000-0000-0000-0000-000000000012',
      'a3000000-0000-0000-0000-000000000012',
      1,
      3
    )
  $test$,
    'super admin can insert building_blueprint_tiers in any world'
  );

reset role;

-- ===========================================================================
-- CASCADE DELETE: deleting a blueprint removes its tiers
-- ===========================================================================
select
  ok (
    exists (
      select
        1
      from
        public.building_blueprint_tiers
      where
        id = 'a4000000-0000-0000-0000-000000000001'
    ),
    'tier exists before blueprint deletion'
  );

delete from public.building_blueprints
where
  id = 'a3000000-0000-0000-0000-000000000001';

select
  ok (
    not exists (
      select
        1
      from
        public.building_blueprint_tiers
      where
        id = 'a4000000-0000-0000-0000-000000000001'
    ),
    'cascade delete removes tiers when blueprint is deleted'
  );

-- ===========================================================================
-- CONSTRAINTS: run without a role so postgres bypasses RLS
-- ===========================================================================
-- Re-insert the blueprint we just deleted so constraint tests have a target.
insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'a3000000-0000-0000-0000-000000000099',
    'a2000000-0000-0000-0000-000000000001',
    'Constraint Test Blueprint',
    'constraint-test-blueprint'
  );

-- tier_number uniqueness
insert into
  public.building_blueprint_tiers (
    building_blueprint_id,
    tier_number,
    worker_turns_required
  )
values
  ('a3000000-0000-0000-0000-000000000099', 1, 0);

select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (
      building_blueprint_id, tier_number, worker_turns_required
    )
    values (
      'a3000000-0000-0000-0000-000000000099',
      1,
      0
    )
  $test$,
    '23505',
    null,
    'duplicate (building_blueprint_id, tier_number) rejected by unique constraint'
  );

-- tier_number < 1
select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (
      building_blueprint_id, tier_number, worker_turns_required
    )
    values (
      'a3000000-0000-0000-0000-000000000099',
      0,
      0
    )
  $test$,
    '23514',
    null,
    'tier_number = 0 rejected by check constraint (must be >= 1)'
  );

-- worker_turns_required < 0
select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (
      building_blueprint_id, tier_number, worker_turns_required
    )
    values (
      'a3000000-0000-0000-0000-000000000099',
      2,
      -1
    )
  $test$,
    '23514',
    null,
    'worker_turns_required = -1 rejected by check constraint (must be >= 0)'
  );

select
  *
from
  finish ();

rollback;
