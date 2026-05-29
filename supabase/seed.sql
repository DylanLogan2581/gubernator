-- Gubernator local development seed data.
--
-- This file is applied automatically by `supabase db reset`.
-- Keep seed data minimal, deterministic, and safe to re-run.
-- These credentials are for local development only; never reuse them in hosted
-- Supabase projects or production data.
insert into
  auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    email_change_token_current,
    reauthentication_token,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
values
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'superadmin@gubernator.local',
    crypt ('password123', gen_salt ('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"local_super_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'test@gubernator.local',
    crypt ('password123', gen_salt ('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"local_test_user"}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'other@gubernator.local',
    crypt ('password123', gen_salt ('bf')),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"local_other_user"}'::jsonb,
    now(),
    now()
  )
on conflict (id) do update
set
  aud = excluded.aud,
  role = excluded.role,
  email = excluded.email,
  encrypted_password = excluded.encrypted_password,
  email_confirmed_at = excluded.email_confirmed_at,
  confirmation_token = excluded.confirmation_token,
  recovery_token = excluded.recovery_token,
  email_change_token_new = excluded.email_change_token_new,
  email_change = excluded.email_change,
  email_change_token_current = excluded.email_change_token_current,
  reauthentication_token = excluded.reauthentication_token,
  raw_app_meta_data = excluded.raw_app_meta_data,
  raw_user_meta_data = excluded.raw_user_meta_data,
  updated_at = now();

insert into
  auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  )
values
  (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',
    '{"sub":"00000000-0000-0000-0000-000000000001","email":"superadmin@gubernator.local","email_verified":true,"phone_verified":false}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000002',
    '{"sub":"00000000-0000-0000-0000-000000000002","email":"test@gubernator.local","email_verified":true,"phone_verified":false}'::jsonb,
    'email',
    now(),
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000003',
    '{"sub":"00000000-0000-0000-0000-000000000003","email":"other@gubernator.local","email_verified":true,"phone_verified":false}'::jsonb,
    'email',
    now(),
    now(),
    now()
  )
on conflict (provider, provider_id) do update
set
  user_id = excluded.user_id,
  identity_data = excluded.identity_data,
  last_sign_in_at = excluded.last_sign_in_at,
  updated_at = now();

update public.users
set
  username = 'local_super_admin',
  status = 'active',
  is_super_admin = true
where
  id = '00000000-0000-0000-0000-000000000001';

update public.users
set
  username = 'local_test_user',
  status = 'active',
  is_super_admin = false
where
  id = '00000000-0000-0000-0000-000000000002';

update public.users
set
  username = 'local_other_user',
  status = 'active',
  is_super_admin = false
where
  id = '00000000-0000-0000-0000-000000000003';

insert into
  public.worlds (
    id,
    name,
    owner_id,
    current_turn_number,
    visibility,
    status,
    calendar_config_json
  )
values
  (
    '00000000-0000-0000-0000-000000000101',
    'Local Development World',
    '00000000-0000-0000-0000-000000000001',
    0,
    'private',
    'active',
    public.default_calendar_config ()
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    'Test User World',
    '00000000-0000-0000-0000-000000000002',
    1,
    'private',
    'active',
    public.default_calendar_config ()
  ),
  (
    '00000000-0000-0000-0000-000000000103',
    'Restricted Development World',
    '00000000-0000-0000-0000-000000000003',
    3,
    'private',
    'active',
    public.default_calendar_config ()
  )
on conflict (id) do update
set
  name = excluded.name,
  owner_id = excluded.owner_id,
  current_turn_number = excluded.current_turn_number,
  visibility = excluded.visibility,
  status = excluded.status,
  calendar_config_json = excluded.calendar_config_json,
  archived_at = null,
  updated_at = now();

insert into
  public.world_admins (world_id, user_id)
values
  (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000002'
  )
on conflict (world_id, user_id) do nothing;

insert into
  public.nations (id, world_id, name, description, is_hidden)
values
  (
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000101',
    'Kingdom of Ashvale',
    'Local development nation for Epic 2 turn and calendar workflows.',
    false
  ),
  (
    '00000000-0000-0000-0000-000000000202',
    '00000000-0000-0000-0000-000000000101',
    'Free Coast of Tideholm',
    'Coastal partner nation for Epic 3 relationship and partnership testing.',
    false
  ),
  (
    '00000000-0000-0000-0000-000000000203',
    '00000000-0000-0000-0000-000000000101',
    'Realm of Stoneridge',
    'Third nation in world 101 so bilateral, unilateral, and pending relationship rows can coexist without conflicting on the (from, to) uniqueness constraint.',
    false
  )
on conflict (id) do update
set
  world_id = excluded.world_id,
  name = excluded.name,
  description = excluded.description,
  is_hidden = excluded.is_hidden,
  updated_at = now();

insert into
  public.settlements (
    id,
    nation_id,
    name,
    description,
    coord_x,
    coord_z,
    auto_ready_enabled,
    is_ready_current_turn,
    last_ready_at,
    ready_set_at,
    ready_set_by_citizen_id
  )
values
  (
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000201',
    'Hearthwatch',
    'Manual-ready settlement for local readiness summary testing.',
    12.5000,
    -4.2500,
    false,
    true,
    '2026-05-03 12:00:00+00',
    '2026-05-03 12:00:00+00',
    null
  ),
  (
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0000-000000000201',
    'Mistfall Crossing',
    'Not-ready settlement for local readiness summary testing.',
    18.0000,
    7.7500,
    false,
    false,
    null,
    null,
    null
  ),
  (
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0000-000000000201',
    'Sunmere Hold',
    'Auto-ready settlement for local end-turn reset testing.',
    -3.1250,
    14.5000,
    true,
    false,
    null,
    null,
    null
  ),
  (
    '00000000-0000-0000-0000-000000000304',
    '00000000-0000-0000-0000-000000000202',
    'Tidewatch',
    'Coastal settlement under the Free Coast of Tideholm for relationship testing.',
    -22.5000,
    -8.7500,
    false,
    false,
    null,
    null,
    null
  ),
  (
    '00000000-0000-0000-0000-000000000305',
    '00000000-0000-0000-0000-000000000203',
    'Stonehold Keep',
    'Capital settlement of the Realm of Stoneridge.',
    5.7500,
    -19.2500,
    false,
    false,
    null,
    null,
    null
  )
on conflict (id) do update
set
  nation_id = excluded.nation_id,
  name = excluded.name,
  description = excluded.description,
  coord_x = excluded.coord_x,
  coord_z = excluded.coord_z,
  auto_ready_enabled = excluded.auto_ready_enabled,
  is_ready_current_turn = excluded.is_ready_current_turn,
  last_ready_at = excluded.last_ready_at,
  ready_set_at = excluded.ready_set_at,
  ready_set_by_citizen_id = excluded.ready_set_by_citizen_id,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- World 101 — Epic 3 citizens, partnerships, relationships, and active PCs.
--
-- Seed runs as the database superuser, so the column-level grants on
-- public.citizens (which lock direct writes to user_id and role_* for the
-- authenticated role) do not apply. The role-assignment and character-link
-- RPCs check auth.uid(), so they cannot be used from the seed.
-- ---------------------------------------------------------------------------
-- Player characters: insert parents/leaf rows first since two rows reference
-- each other through parent_a/parent_b later. Player characters carry user_id
-- (required by citizens_player_character_user_id_check); NPCs leave it null.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    name,
    sex,
    status,
    born_on_turn_number,
    user_id,
    role_type,
    role_nation_id,
    role_settlement_id,
    personality_text,
    skills_text
  )
values
  (
    '00000000-0000-0000-0000-000000000401',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000301',
    'player_character',
    'Aria of Hearthwatch',
    'female',
    'alive',
    -28,
    '00000000-0000-0000-0000-000000000002',
    'settlement_manager',
    null,
    '00000000-0000-0000-0000-000000000301',
    'Pragmatic mayor who keeps the watch turning over.',
    'Logistics, masonry, town-square diplomacy.'
  ),
  (
    '00000000-0000-0000-0000-000000000402',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000302',
    'player_character',
    'Halden Reyne',
    'male',
    'alive',
    -34,
    '00000000-0000-0000-0000-000000000003',
    'nation_manager',
    '00000000-0000-0000-0000-000000000201',
    null,
    'Career civil servant; reads every treaty twice.',
    'Statecraft, ledger work, courtly debate.'
  ),
  (
    '00000000-0000-0000-0000-000000000403',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000303',
    'player_character',
    'Kestrel Vale',
    'female',
    'alive',
    -22,
    '00000000-0000-0000-0000-000000000001',
    'none',
    null,
    null,
    'Wandering observer with no formal portfolio.',
    'Cartography, surveying, quiet listening.'
  )
on conflict (id) do update
set
  world_id = excluded.world_id,
  settlement_id = excluded.settlement_id,
  citizen_type = excluded.citizen_type,
  name = excluded.name,
  sex = excluded.sex,
  status = excluded.status,
  born_on_turn_number = excluded.born_on_turn_number,
  user_id = excluded.user_id,
  role_type = excluded.role_type,
  role_nation_id = excluded.role_nation_id,
  role_settlement_id = excluded.role_settlement_id,
  personality_text = excluded.personality_text,
  skills_text = excluded.skills_text,
  updated_at = now();

-- Stand-alone NPCs spread across the four settlements with full flavor
-- populated. The two family parents below get their own insert so the child
-- row (whose parent FKs reference them) can be inserted in a separate
-- statement and rely on parents already being present.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    name,
    sex,
    status,
    born_on_turn_number,
    npc_trait_1,
    npc_trait_2,
    npc_secret_contradiction,
    npc_goal,
    npc_flaw
  )
values
  (
    '00000000-0000-0000-0000-000000000411',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000301',
    'npc',
    'Mara Quill',
    'female',
    'alive',
    -41,
    'earnest',
    'patient',
    'mourns a friend they betrayed',
    'a seat on the council',
    'pride'
  ),
  (
    '00000000-0000-0000-0000-000000000412',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000302',
    'npc',
    'Joren Bask',
    'male',
    'alive',
    -38,
    'wry',
    'boisterous',
    'loves their rival',
    'to restore their family''s name',
    'an addiction to risk'
  ),
  (
    '00000000-0000-0000-0000-000000000413',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000303',
    'npc',
    'Sable Wren',
    'female',
    'alive',
    -29,
    'haunted',
    'earnest',
    'mourns a friend they betrayed',
    'to restore their family''s name',
    'envy'
  ),
  (
    '00000000-0000-0000-0000-000000000414',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000304',
    'npc',
    'Pell Auren',
    'male',
    'alive',
    -45,
    'patient',
    'wry',
    'loves their rival',
    'a seat on the council',
    'pride'
  )
on conflict (id) do update
set
  world_id = excluded.world_id,
  settlement_id = excluded.settlement_id,
  citizen_type = excluded.citizen_type,
  name = excluded.name,
  sex = excluded.sex,
  status = excluded.status,
  born_on_turn_number = excluded.born_on_turn_number,
  npc_trait_1 = excluded.npc_trait_1,
  npc_trait_2 = excluded.npc_trait_2,
  npc_secret_contradiction = excluded.npc_secret_contradiction,
  npc_goal = excluded.npc_goal,
  npc_flaw = excluded.npc_flaw,
  updated_at = now();

-- NPC family parents — inserted before the child row so the
-- parent_a/parent_b FKs (and composite world FKs) resolve.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    name,
    sex,
    status,
    born_on_turn_number,
    npc_trait_1,
    npc_trait_2,
    npc_secret_contradiction,
    npc_goal,
    npc_flaw
  )
values
  (
    '00000000-0000-0000-0000-000000000421',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000301',
    'npc',
    'Tessen Marrow',
    'female',
    'alive',
    -52,
    'earnest',
    'patient',
    'mourns a friend they betrayed',
    'to restore their family''s name',
    'pride'
  ),
  (
    '00000000-0000-0000-0000-000000000422',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000301',
    'npc',
    'Rhys Marrow',
    'male',
    'alive',
    -50,
    'boisterous',
    'wry',
    'loves their rival',
    'a seat on the council',
    'an addiction to risk'
  )
on conflict (id) do update
set
  world_id = excluded.world_id,
  settlement_id = excluded.settlement_id,
  citizen_type = excluded.citizen_type,
  name = excluded.name,
  sex = excluded.sex,
  status = excluded.status,
  born_on_turn_number = excluded.born_on_turn_number,
  npc_trait_1 = excluded.npc_trait_1,
  npc_trait_2 = excluded.npc_trait_2,
  npc_secret_contradiction = excluded.npc_secret_contradiction,
  npc_goal = excluded.npc_goal,
  npc_flaw = excluded.npc_flaw,
  updated_at = now();

-- NPC family child + a deceased NPC with death_cause populated.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    name,
    sex,
    status,
    born_on_turn_number,
    parent_a_citizen_id,
    parent_b_citizen_id,
    npc_trait_1,
    npc_trait_2,
    npc_secret_contradiction,
    npc_goal,
    npc_flaw,
    death_cause
  )
values
  (
    '00000000-0000-0000-0000-000000000423',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000301',
    'npc',
    'Wren Marrow',
    'female',
    'alive',
    -8,
    '00000000-0000-0000-0000-000000000421',
    '00000000-0000-0000-0000-000000000422',
    'earnest',
    'wry',
    'mourns a friend they betrayed',
    'a seat on the council',
    'envy',
    null
  ),
  (
    '00000000-0000-0000-0000-000000000431',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000302',
    'npc',
    'Old Mara of the Crossing',
    'female',
    'dead',
    -73,
    null,
    null,
    'haunted',
    'patient',
    'mourns a friend they betrayed',
    'to restore their family''s name',
    'pride',
    'Died peacefully during the winter following turn 0.'
  )
on conflict (id) do update
set
  world_id = excluded.world_id,
  settlement_id = excluded.settlement_id,
  citizen_type = excluded.citizen_type,
  name = excluded.name,
  sex = excluded.sex,
  status = excluded.status,
  born_on_turn_number = excluded.born_on_turn_number,
  parent_a_citizen_id = excluded.parent_a_citizen_id,
  parent_b_citizen_id = excluded.parent_b_citizen_id,
  npc_trait_1 = excluded.npc_trait_1,
  npc_trait_2 = excluded.npc_trait_2,
  npc_secret_contradiction = excluded.npc_secret_contradiction,
  npc_goal = excluded.npc_goal,
  npc_flaw = excluded.npc_flaw,
  death_cause = excluded.death_cause,
  updated_at = now();

-- Active partnership between two living NPCs (Mara Quill + Joren Bask) plus a
-- historical (dissolved) partnership between Sable Wren and Pell Auren. The
-- partial unique indexes
-- partnerships_unique_active_citizen_{a,b}_idx allow at most one active row
-- per citizen, so the dissolved pair uses different citizens from the active
-- pair.
insert into
  public.partnerships (
    id,
    citizen_a_id,
    citizen_b_id,
    status,
    formed_on_turn_number,
    ended_on_turn_number,
    changed_by_user_id,
    change_reason
  )
values
  (
    '00000000-0000-0000-0000-000000000501',
    '00000000-0000-0000-0000-000000000411',
    '00000000-0000-0000-0000-000000000412',
    'active',
    0,
    null,
    null,
    null
  ),
  (
    '00000000-0000-0000-0000-000000000502',
    '00000000-0000-0000-0000-000000000413',
    '00000000-0000-0000-0000-000000000414',
    'dissolved',
    0,
    0,
    '00000000-0000-0000-0000-000000000001',
    'Seeded historical dissolution so the partnership history panel has more than one row.'
  )
on conflict (id) do update
set
  citizen_a_id = excluded.citizen_a_id,
  citizen_b_id = excluded.citizen_b_id,
  status = excluded.status,
  formed_on_turn_number = excluded.formed_on_turn_number,
  ended_on_turn_number = excluded.ended_on_turn_number,
  changed_by_user_id = excluded.changed_by_user_id,
  change_reason = excluded.change_reason,
  updated_at = now();

-- Bilateral mirror trigger is skipped while seeding so both directional rows
-- can be written explicitly with deterministic UUIDs and pending_* shapes.
-- The session-local flag is unset again afterwards so any post-seed work in
-- the same session falls back to normal mirror behavior.
select
  set_config('app.skip_bilateral_mirror', 'true', false);

insert into
  public.nation_relationships (
    id,
    from_nation_id,
    to_nation_id,
    world_id,
    current_stance,
    pending_stance,
    pending_status,
    pending_changed_by_citizen_id
  )
values
  -- Bilateral allied: proposer row (Ashvale → Stoneridge) carries the
  -- accepted pending status and the proposer citizen. Stoneridge has no PC
  -- manager in the seed, so its mirror row keeps the pending_* columns null
  -- exactly as the mirror trigger would produce in production.
  (
    '00000000-0000-0000-0000-000000000601',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000203',
    '00000000-0000-0000-0000-000000000101',
    'allied',
    null,
    'accepted',
    '00000000-0000-0000-0000-000000000402'
  ),
  (
    '00000000-0000-0000-0000-000000000602',
    '00000000-0000-0000-0000-000000000203',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000101',
    'allied',
    null,
    null,
    null
  ),
  -- Unilateral hostile stance from Ashvale toward Tideholm. Unilateral
  -- stances do not produce a mirror row.
  (
    '00000000-0000-0000-0000-000000000603',
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000202',
    '00000000-0000-0000-0000-000000000101',
    'hostile',
    null,
    null,
    null
  ),
  -- Pending proposal awaiting acceptance: Tideholm proposes a
  -- non_aggression_pact to Stoneridge. current_stance stays neutral until
  -- accepted.
  (
    '00000000-0000-0000-0000-000000000604',
    '00000000-0000-0000-0000-000000000202',
    '00000000-0000-0000-0000-000000000203',
    '00000000-0000-0000-0000-000000000101',
    'neutral',
    'non_aggression_pact',
    'proposed',
    '00000000-0000-0000-0000-000000000414'
  )
on conflict (from_nation_id, to_nation_id) do update
set
  current_stance = excluded.current_stance,
  pending_stance = excluded.pending_stance,
  pending_status = excluded.pending_status,
  pending_changed_by_citizen_id = excluded.pending_changed_by_citizen_id,
  updated_at = now();

select
  set_config('app.skip_bilateral_mirror', 'false', false);

-- Active player character resume mapping for the two non-superadmin users.
-- Superadmin is intentionally left out so the active-character chooser UI
-- still has an "unresolved" path to exercise locally.
insert into
  public.user_active_player_characters (user_id, world_id, citizen_id)
values
  (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000401'
  ),
  (
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000402'
  )
on conflict (user_id, world_id) do update
set
  citizen_id = excluded.citizen_id,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- World 102 — Test User World. Minimal Epic 3 surface plus a custom NPC
-- flavor pool so the per-world `npc_flavor_config_json` column is exercised.
-- ---------------------------------------------------------------------------
update public.worlds
set
  npc_flavor_config_json = '{
    "traits": ["bookish", "stoic", "needling"],
    "contradictions": ["secretly funds their rivals", "writes sonnets they will never publish"],
    "goals": ["map every uncharted coast", "found a free school"],
    "flaws": ["overconfidence in their own ledger work", "hoards favors"]
  }'::jsonb
where
  id = '00000000-0000-0000-0000-000000000102';

insert into
  public.nations (id, world_id, name, description, is_hidden)
values
  (
    '00000000-0000-0000-0000-000000000211',
    '00000000-0000-0000-0000-000000000102',
    'Concord of Linn',
    'Sole nation in the Test User World for minimal-topology checks.',
    false
  )
on conflict (id) do update
set
  world_id = excluded.world_id,
  name = excluded.name,
  description = excluded.description,
  is_hidden = excluded.is_hidden,
  updated_at = now();

insert into
  public.settlements (
    id,
    nation_id,
    name,
    description,
    coord_x,
    coord_z,
    auto_ready_enabled,
    is_ready_current_turn,
    last_ready_at,
    ready_set_at,
    ready_set_by_citizen_id
  )
values
  (
    '00000000-0000-0000-0000-000000000311',
    '00000000-0000-0000-0000-000000000211',
    'Linnford',
    'Capital settlement of the Concord of Linn.',
    0.0000,
    0.0000,
    false,
    false,
    null,
    null,
    null
  )
on conflict (id) do update
set
  nation_id = excluded.nation_id,
  name = excluded.name,
  description = excluded.description,
  coord_x = excluded.coord_x,
  coord_z = excluded.coord_z,
  auto_ready_enabled = excluded.auto_ready_enabled,
  is_ready_current_turn = excluded.is_ready_current_turn,
  last_ready_at = excluded.last_ready_at,
  ready_set_at = excluded.ready_set_at,
  ready_set_by_citizen_id = excluded.ready_set_by_citizen_id,
  updated_at = now();

insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    name,
    sex,
    status,
    born_on_turn_number,
    npc_trait_1,
    npc_trait_2,
    npc_secret_contradiction,
    npc_goal,
    npc_flaw
  )
values
  (
    '00000000-0000-0000-0000-000000000451',
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000311',
    'npc',
    'Vellan Pace',
    'male',
    'alive',
    -33,
    'bookish',
    'stoic',
    'secretly funds their rivals',
    'found a free school',
    'hoards favors'
  )
on conflict (id) do update
set
  world_id = excluded.world_id,
  settlement_id = excluded.settlement_id,
  citizen_type = excluded.citizen_type,
  name = excluded.name,
  sex = excluded.sex,
  status = excluded.status,
  born_on_turn_number = excluded.born_on_turn_number,
  npc_trait_1 = excluded.npc_trait_1,
  npc_trait_2 = excluded.npc_trait_2,
  npc_secret_contradiction = excluded.npc_secret_contradiction,
  npc_goal = excluded.npc_goal,
  npc_flaw = excluded.npc_flaw,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- World 103 — Restricted Development World. Minimal Epic 3 surface plus a
-- non-default `incest_prevention_depth` so the per-world depth column is
-- exercised away from its default (4). A value of 1 keeps the sibling check
-- on but disables first-cousin and beyond.
-- ---------------------------------------------------------------------------
update public.worlds
set
  incest_prevention_depth = 1
where
  id = '00000000-0000-0000-0000-000000000103';

insert into
  public.nations (id, world_id, name, description, is_hidden)
values
  (
    '00000000-0000-0000-0000-000000000221',
    '00000000-0000-0000-0000-000000000103',
    'March of Greyfell',
    'Sole nation in the Restricted Development World.',
    false
  )
on conflict (id) do update
set
  world_id = excluded.world_id,
  name = excluded.name,
  description = excluded.description,
  is_hidden = excluded.is_hidden,
  updated_at = now();

insert into
  public.settlements (
    id,
    nation_id,
    name,
    description,
    coord_x,
    coord_z,
    auto_ready_enabled,
    is_ready_current_turn,
    last_ready_at,
    ready_set_at,
    ready_set_by_citizen_id
  )
values
  (
    '00000000-0000-0000-0000-000000000321',
    '00000000-0000-0000-0000-000000000221',
    'Greyfell Hold',
    'Capital settlement of the March of Greyfell.',
    0.0000,
    0.0000,
    false,
    false,
    null,
    null,
    null
  )
on conflict (id) do update
set
  nation_id = excluded.nation_id,
  name = excluded.name,
  description = excluded.description,
  coord_x = excluded.coord_x,
  coord_z = excluded.coord_z,
  auto_ready_enabled = excluded.auto_ready_enabled,
  is_ready_current_turn = excluded.is_ready_current_turn,
  last_ready_at = excluded.last_ready_at,
  ready_set_at = excluded.ready_set_at,
  ready_set_by_citizen_id = excluded.ready_set_by_citizen_id,
  updated_at = now();

insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    name,
    sex,
    status,
    born_on_turn_number,
    npc_trait_1,
    npc_trait_2,
    npc_secret_contradiction,
    npc_goal,
    npc_flaw
  )
values
  (
    '00000000-0000-0000-0000-000000000461',
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000321',
    'npc',
    'Ivor Greyfell',
    'male',
    'alive',
    -40,
    'haunted',
    'wry',
    'mourns a friend they betrayed',
    'a seat on the council',
    'envy'
  )
on conflict (id) do update
set
  world_id = excluded.world_id,
  settlement_id = excluded.settlement_id,
  citizen_type = excluded.citizen_type,
  name = excluded.name,
  sex = excluded.sex,
  status = excluded.status,
  born_on_turn_number = excluded.born_on_turn_number,
  npc_trait_1 = excluded.npc_trait_1,
  npc_trait_2 = excluded.npc_trait_2,
  npc_secret_contradiction = excluded.npc_secret_contradiction,
  npc_goal = excluded.npc_goal,
  npc_flaw = excluded.npc_flaw,
  updated_at = now();
