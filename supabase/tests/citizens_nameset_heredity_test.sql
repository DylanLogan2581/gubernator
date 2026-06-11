-- pgTAP tests for citizen nameset heredity support.
-- Covers: citizens.nameset_id column + FK ON DELETE SET NULL, the
-- create_citizen_internal nameset validation (wrong world / trashed / missing
-- degrade to null), create_npc passthrough, the citizen birth payload
-- namesetId persistence, the renamed convention validator, and
-- default_naming_config.
-- Run with: npx supabase test db
begin;

select
  plan (19);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'c1000000-0000-0000-0000-000000000001',
    'Nameset Heredity World',
    5,
    'private',
    'active'
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    'Nameset Heredity Other World',
    1,
    'private',
    'active'
  );

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
    'c0000000-0000-0000-0000-000000000001',
    'nameset-heredity-admin@example.com',
    'x',
    now(),
    '{"username":"nameset_heredity_admin"}'::jsonb,
    now(),
    now()
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'c1000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001'
  );

insert into
  public.turn_transitions (
    id,
    world_id,
    from_turn_number,
    to_turn_number,
    initiated_by_user_id,
    status
  )
values
  (
    'c5000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    5,
    6,
    'c0000000-0000-0000-0000-000000000001',
    'running'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'Heredity Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'c3000000-0000-0000-0000-000000000001',
    'c2000000-0000-0000-0000-000000000001',
    'Heredity Settlement'
  );

insert into
  public.namesets (
    id,
    world_id,
    name,
    config_json,
    is_default,
    is_trashed
  )
values
  (
    'c4000000-0000-0000-0000-000000000001',
    'c1000000-0000-0000-0000-000000000001',
    'Active Nameset',
    public.default_naming_config (),
    false,
    false
  ),
  (
    'c4000000-0000-0000-0000-000000000002',
    'c1000000-0000-0000-0000-000000000001',
    'Trashed Nameset',
    public.default_naming_config (),
    false,
    true
  ),
  (
    'c4000000-0000-0000-0000-000000000003',
    'c1000000-0000-0000-0000-000000000002',
    'Other World Nameset',
    public.default_naming_config (),
    false,
    false
  ),
  (
    'c4000000-0000-0000-0000-000000000004',
    'c1000000-0000-0000-0000-000000000001',
    'Deletable Nameset',
    public.default_naming_config (),
    false,
    false
  );

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
select
  has_column (
    'public',
    'citizens',
    'nameset_id',
    'citizens has a nameset_id column'
  );

select
  ok (
    has_column_privilege(
      'authenticated',
      'public.citizens',
      'nameset_id',
      'SELECT'
    ),
    'authenticated can select citizens.nameset_id (column-level grants)'
  );

-- ---------------------------------------------------------------------------
-- create_npc nameset handling (as an authenticated world admin)
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        c.nameset_id
      from
        public.create_npc (
          'c1000000-0000-0000-0000-000000000001'::uuid,
          'Valid Nameset Citizen',
          'c3000000-0000-0000-0000-000000000001'::uuid,
          p_nameset_id => 'c4000000-0000-0000-0000-000000000001'::uuid
        ) c
    ),
    'c4000000-0000-0000-0000-000000000001'::uuid,
    'create_npc stores a valid same-world nameset'
  );

select
  is (
    (
      select
        c.nameset_id
      from
        public.create_npc (
          'c1000000-0000-0000-0000-000000000001'::uuid,
          'Null Nameset Citizen',
          'c3000000-0000-0000-0000-000000000001'::uuid
        ) c
    ),
    null::uuid,
    'create_npc stores null when no nameset is given'
  );

select
  is (
    (
      select
        c.nameset_id
      from
        public.create_npc (
          'c1000000-0000-0000-0000-000000000001'::uuid,
          'Trashed Nameset Citizen',
          'c3000000-0000-0000-0000-000000000001'::uuid,
          p_nameset_id => 'c4000000-0000-0000-0000-000000000002'::uuid
        ) c
    ),
    null::uuid,
    'a trashed nameset degrades to null instead of blocking creation'
  );

select
  is (
    (
      select
        c.nameset_id
      from
        public.create_npc (
          'c1000000-0000-0000-0000-000000000001'::uuid,
          'Cross World Nameset Citizen',
          'c3000000-0000-0000-0000-000000000001'::uuid,
          p_nameset_id => 'c4000000-0000-0000-0000-000000000003'::uuid
        ) c
    ),
    null::uuid,
    'a nameset from another world degrades to null'
  );

select
  is (
    (
      select
        c.nameset_id
      from
        public.create_npc (
          'c1000000-0000-0000-0000-000000000001'::uuid,
          'Missing Nameset Citizen',
          'c3000000-0000-0000-0000-000000000001'::uuid,
          p_nameset_id => 'c4999999-0000-0000-0000-000000000999'::uuid
        ) c
    ),
    null::uuid,
    'a nonexistent nameset degrades to null'
  );

select
  isnt_empty (
    $q$
      select 1
      from public.citizens
      where given_name = 'Trashed Nameset Citizen'
    $q$,
    'the citizen is still created when its nameset is invalid'
  );

reset role;

-- ---------------------------------------------------------------------------
-- FK behavior: deleting a nameset nulls the citizen reference
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"c0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $q$
      select public.create_npc (
        'c1000000-0000-0000-0000-000000000001'::uuid,
        'Orphaned Nameset Citizen',
        'c3000000-0000-0000-0000-000000000001'::uuid,
        p_nameset_id => 'c4000000-0000-0000-0000-000000000004'::uuid
      )
    $q$,
    'creates a citizen pointing at the deletable nameset'
  );

reset role;

delete from public.namesets
where
  id = 'c4000000-0000-0000-0000-000000000004';

select
  is (
    (
      select
        nameset_id
      from
        public.citizens
      where
        given_name = 'Orphaned Nameset Citizen'
    ),
    null::uuid,
    'deleting a nameset sets citizens.nameset_id to null'
  );

-- ---------------------------------------------------------------------------
-- Birth payload namesetId persistence (apply_turn_transition birth loop)
-- ---------------------------------------------------------------------------
set
  local role service_role;

select
  lives_ok (
    $q$
      select public.apply_turn_transition (
        'c1000000-0000-0000-0000-000000000001',
        5,
        jsonb_build_object(
          'citizenBirths',
          jsonb_build_array(
            jsonb_build_object(
              'settlementId', 'c3000000-0000-0000-0000-000000000001',
              'givenName', 'Birth With Nameset',
              'surname', 'Heir',
              'sex', 'female',
              'bornOnTurnNumber', 6,
              'namesetId', 'c4000000-0000-0000-0000-000000000001'
            ),
            jsonb_build_object(
              'settlementId', 'c3000000-0000-0000-0000-000000000001',
              'givenName', 'Birth Without Nameset',
              'sex', 'male',
              'bornOnTurnNumber', 6
            )
          )
        ),
        'c5000000-0000-0000-0000-000000000001'::uuid
      )
    $q$,
    'apply_turn_transition accepts birth payloads with and without namesetId'
  );

reset role;

select
  is (
    (
      select
        nameset_id
      from
        public.citizens
      where
        given_name = 'Birth With Nameset'
    ),
    'c4000000-0000-0000-0000-000000000001'::uuid,
    'a birth payload namesetId is persisted on the newborn'
  );

select
  is (
    (
      select
        nameset_id
      from
        public.citizens
      where
        given_name = 'Birth Without Nameset'
    ),
    null::uuid,
    'a birth payload without namesetId stores null'
  );

-- ---------------------------------------------------------------------------
-- Convention validator and default config
-- ---------------------------------------------------------------------------
select
  ok (
    public.is_valid_naming_config (
      '{"male_given_names":["A"],"female_given_names":["B"],"surnames":["C"],"convention":"pool"}'::jsonb
    ),
    'validator accepts the pool convention'
  );

select
  ok (
    public.is_valid_naming_config (
      '{"male_given_names":[],"female_given_names":[],"surnames":[],"convention":"family-name"}'::jsonb
    ),
    'validator accepts the family-name convention'
  );

select
  ok (
    public.is_valid_naming_config (
      '{"male_given_names":[],"female_given_names":[],"surnames":[],"convention":"none"}'::jsonb
    ),
    'validator accepts the none convention'
  );

select
  ok (
    not public.is_valid_naming_config (
      '{"male_given_names":[],"female_given_names":[],"surnames":[],"convention":"random"}'::jsonb
    ),
    'validator rejects the retired random convention'
  );

select
  ok (
    not public.is_valid_naming_config (
      '{"male_given_names":[],"female_given_names":[],"surnames":[],"convention":"inherited family name"}'::jsonb
    ),
    'validator rejects the retired inherited family name convention'
  );

select
  is (
    public.default_naming_config () ->> 'convention',
    'pool',
    'default_naming_config uses the pool convention'
  );

select
  *
from
  finish ();

rollback;
