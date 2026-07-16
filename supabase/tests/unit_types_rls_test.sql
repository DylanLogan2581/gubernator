-- pgTAP tests for public.unit_types RLS and column constraints.
-- Run with: npx supabase test db
begin;

select
  plan (23);

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
    'b1000000-0000-0000-0000-000000000001',
    'ut-owner@example.com',
    'x',
    now(),
    '{"username":"ut_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1000000-0000-0000-0000-000000000002',
    'ut-admin@example.com',
    'x',
    now(),
    '{"username":"ut_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1000000-0000-0000-0000-000000000003',
    'ut-outsider@example.com',
    'x',
    now(),
    '{"username":"ut_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'b1000000-0000-0000-0000-000000000004',
    'ut-superadmin@example.com',
    'x',
    now(),
    '{"username":"ut_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'b1000000-0000-0000-0000-000000000004';

insert into
  public.worlds (id, name, status)
values
  (
    'b2000000-0000-0000-0000-000000000001',
    'UT Private World',
    'active'
  ),
  (
    'b2000000-0000-0000-0000-000000000002',
    'UT Public World',
    'active'
  ),
  (
    'b2000000-0000-0000-0000-000000000003',
    'UT Outsider World',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'b2000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000001'
  ),
  (
    'b2000000-0000-0000-0000-000000000001',
    'b1000000-0000-0000-0000-000000000002'
  );

insert into
  public.education_levels (id, world_id, name, rank)
values
  (
    'b3000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'Basic',
    1
  );

insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'b4000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'Barracks',
    'barracks'
  );

insert into
  public.building_blueprint_tiers (id, building_blueprint_id, tier_number)
values
  (
    'b5000000-0000-0000-0000-000000000001',
    'b4000000-0000-0000-0000-000000000001',
    1
  );

-- Seed a unit type in the private world for read/write tests.
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
    'b6000000-0000-0000-0000-000000000001',
    'b2000000-0000-0000-0000-000000000001',
    'Levy',
    10,
    0.05
  );

-- Seed a unit type in the public world for outsider read tests.
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
    'b6000000-0000-0000-0000-000000000002',
    'b2000000-0000-0000-0000-000000000002',
    'Spearman',
    8,
    0.1
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
        public.unit_types
    ),
    0,
    'anon cannot read unit_types'
  );

reset role;

-- ===========================================================================
-- OUTSIDER: can read public-world unit types; cannot read private; cannot write
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  ok (
    not exists (
      select
        1
      from
        public.unit_types
      where
        world_id = 'b2000000-0000-0000-0000-000000000002'
    ),
    'outsider cannot read unit_types without admin/pc access'
  );

select
  ok (
    not exists (
      select
        1
      from
        public.unit_types
      where
        world_id = 'b2000000-0000-0000-0000-000000000001'
    ),
    'outsider cannot read unit_types in an inaccessible private world'
  );

select
  throws_ok (
    $test$
    insert into public.unit_types (world_id, name, soldiers_per_unit, desertion_rate)
    values (
      'b2000000-0000-0000-0000-000000000001',
      'Outsider Unit',
      1,
      0
    )
  $test$,
    '42501',
    null,
    'outsider cannot insert unit_types into an inaccessible world'
  );

update public.unit_types
set
  name = 'Outsider Update'
where
  id = 'b6000000-0000-0000-0000-000000000001';

delete from public.unit_types
where
  id = 'b6000000-0000-0000-0000-000000000001';

reset role;

select
  is (
    (
      select
        name
      from
        public.unit_types
      where
        id = 'b6000000-0000-0000-0000-000000000001'
    ),
    'Levy',
    'outsider update is silently ignored by RLS'
  );

select
  ok (
    exists (
      select
        1
      from
        public.unit_types
      where
        id = 'b6000000-0000-0000-0000-000000000001'
    ),
    'outsider delete is silently ignored by RLS'
  );

-- ===========================================================================
-- OWNER: world owners can manage unit_types in their world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.unit_types
      where
        world_id = 'b2000000-0000-0000-0000-000000000001'
    ),
    'owner can read unit_types in their world'
  );

select
  lives_ok (
    $test$
    insert into public.unit_types (
      id, world_id, name, soldiers_per_unit, desertion_rate,
      required_education_level_id, required_building_blueprint_id,
      required_building_tier_number
    )
    values (
      'b6000000-0000-0000-0000-000000000010',
      'b2000000-0000-0000-0000-000000000001',
      'Owner Unit',
      5,
      0.02,
      'b3000000-0000-0000-0000-000000000001',
      'b4000000-0000-0000-0000-000000000001',
      1
    )
  $test$,
    'owner can insert unit_types with valid requirement FKs in their world'
  );

select
  lives_ok (
    $test$
    update public.unit_types
    set name = 'Owner Updated'
    where id = 'b6000000-0000-0000-0000-000000000010'
  $test$,
    'owner can update unit_types in their world'
  );

select
  lives_ok (
    $test$
    delete from public.unit_types
    where id = 'b6000000-0000-0000-0000-000000000010'
  $test$,
    'owner can delete unit_types in their world'
  );

reset role;

-- ===========================================================================
-- WORLD ADMIN: explicit admins can manage unit_types in the world
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  ok (
    exists (
      select
        1
      from
        public.unit_types
      where
        world_id = 'b2000000-0000-0000-0000-000000000001'
    ),
    'world admin can read unit_types in the administered world'
  );

select
  lives_ok (
    $test$
    insert into public.unit_types (id, world_id, name, soldiers_per_unit, desertion_rate)
    values (
      'b6000000-0000-0000-0000-000000000011',
      'b2000000-0000-0000-0000-000000000001',
      'Admin Unit',
      3,
      0
    )
  $test$,
    'world admin can insert unit_types in the administered world'
  );

select
  lives_ok (
    $test$
    update public.unit_types
    set name = 'Admin Updated'
    where id = 'b6000000-0000-0000-0000-000000000011'
  $test$,
    'world admin can update unit_types in the administered world'
  );

select
  lives_ok (
    $test$
    delete from public.unit_types
    where id = 'b6000000-0000-0000-0000-000000000011'
  $test$,
    'world admin can delete unit_types in the administered world'
  );

reset role;

-- ===========================================================================
-- SUPER ADMIN: can read and manage unit_types across all worlds
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"b1000000-0000-0000-0000-000000000004","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.unit_types
      where
        world_id in (
          'b2000000-0000-0000-0000-000000000001',
          'b2000000-0000-0000-0000-000000000002',
          'b2000000-0000-0000-0000-000000000003'
        )
    ),
    2,
    'super admin can read unit_types across all worlds'
  );

select
  lives_ok (
    $test$
    insert into public.unit_types (id, world_id, name, soldiers_per_unit, desertion_rate)
    values (
      'b6000000-0000-0000-0000-000000000012',
      'b2000000-0000-0000-0000-000000000003',
      'Super Admin Unit',
      1,
      0
    )
  $test$,
    'super admin can insert unit_types in any world'
  );

select
  lives_ok (
    $test$
    delete from public.unit_types
    where id = 'b6000000-0000-0000-0000-000000000012'
  $test$,
    'super admin can delete unit_types in any world'
  );

reset role;

-- ===========================================================================
-- COLUMN CONSTRAINTS
-- Run without a role so postgres bypasses RLS and tests CHECK/FK constraints.
-- ===========================================================================
select
  throws_ok (
    $test$
    insert into public.unit_types (world_id, name, soldiers_per_unit, desertion_rate)
    values ('b2000000-0000-0000-0000-000000000001', 'Zero Soldiers', 0, 0)
  $test$,
    '23514',
    null,
    'soldiers_per_unit of zero rejected by check constraint'
  );

select
  throws_ok (
    $test$
    insert into public.unit_types (world_id, name, soldiers_per_unit, desertion_rate)
    values ('b2000000-0000-0000-0000-000000000001', 'Bad Rate', 1, 1.5)
  $test$,
    '23514',
    null,
    'desertion_rate above 1 rejected by check constraint'
  );

select
  throws_ok (
    $test$
    insert into public.unit_types (world_id, name, soldiers_per_unit, desertion_rate)
    values ('b2000000-0000-0000-0000-000000000001', 'Negative Rate', 1, -0.1)
  $test$,
    '23514',
    null,
    'negative desertion_rate rejected by check constraint'
  );

select
  throws_ok (
    $test$
    insert into public.unit_types (
      world_id, name, soldiers_per_unit, desertion_rate,
      required_building_blueprint_id
    )
    values (
      'b2000000-0000-0000-0000-000000000001', 'Blueprint No Tier', 1, 0,
      'b4000000-0000-0000-0000-000000000001'
    )
  $test$,
    '23514',
    null,
    'required building blueprint without tier number rejected by check constraint'
  );

select
  throws_ok (
    $test$
    insert into public.unit_types (
      world_id, name, soldiers_per_unit, desertion_rate,
      required_building_blueprint_id, required_building_tier_number
    )
    values (
      'b2000000-0000-0000-0000-000000000001', 'Bad Tier Number', 1, 0,
      'b4000000-0000-0000-0000-000000000001', 99
    )
  $test$,
    '23503',
    null,
    'required building tier number not matching an existing tier rejected by fk constraint'
  );

select
  throws_ok (
    $test$
    insert into public.unit_types (world_id, name, soldiers_per_unit, desertion_rate)
    values ('b2000000-0000-0000-0000-000000000001', 'Levy', 1, 0)
  $test$,
    '23505',
    null,
    'duplicate unit type name within a world rejected by unique constraint'
  );

select
  *
from
  finish ();

rollback;
