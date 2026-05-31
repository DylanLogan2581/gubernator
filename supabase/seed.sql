-- Gubernator local development seed data.
--
-- This file is applied automatically by `supabase db reset`.
-- Keep seed data deterministic and safe to re-run.
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
    '{"username":"ashvale_warden"}'::jsonb,
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
    '{"username":"aria_hearthwatch"}'::jsonb,
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
    '{"username":"halden_reyne"}'::jsonb,
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
  username = 'ashvale_warden',
  status = 'active',
  is_super_admin = true
where
  id = '00000000-0000-0000-0000-000000000001';

update public.users
set
  username = 'aria_hearthwatch',
  status = 'active',
  is_super_admin = false
where
  id = '00000000-0000-0000-0000-000000000002';

update public.users
set
  username = 'halden_reyne',
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
    'Verdant Reach',
    '00000000-0000-0000-0000-000000000001',
    0,
    'private',
    'active',
    public.default_calendar_config ()
  ),
  (
    '00000000-0000-0000-0000-000000000102',
    'Linnford Concord',
    '00000000-0000-0000-0000-000000000002',
    1,
    'private',
    'active',
    public.default_calendar_config ()
  ),
  (
    '00000000-0000-0000-0000-000000000103',
    'Greyfell March',
    '00000000-0000-0000-0000-000000000003',
    3,
    'private',
    'active',
    public.default_calendar_config ()
  ),
  (
    '00000000-0000-0000-0000-000000000104',
    'Hollowmere Coast',
    '00000000-0000-0000-0000-000000000002',
    0,
    'private',
    'active',
    public.default_calendar_config ()
  ),
  (
    '00000000-0000-0000-0000-000000000105',
    'Stormhold Vale',
    '00000000-0000-0000-0000-000000000003',
    2,
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

-- Per-world settings overrides preserved by tests.
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

update public.worlds
set
  incest_prevention_depth = 1
where
  id = '00000000-0000-0000-0000-000000000103';

insert into
  public.world_admins (world_id, user_id)
values
  -- Verdant Reach: owner-superadmin plus aria as explicit co-admin so the
  -- two-admin path is exercised by default.
  (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000002'
  ),
  -- Each remaining world gets at least its owner as an explicit world admin so
  -- the privileged path is reachable from the seeded accounts.
  (
    '00000000-0000-0000-0000-000000000102',
    '00000000-0000-0000-0000-000000000002'
  ),
  (
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000003'
  ),
  (
    '00000000-0000-0000-0000-000000000104',
    '00000000-0000-0000-0000-000000000002'
  ),
  (
    '00000000-0000-0000-0000-000000000105',
    '00000000-0000-0000-0000-000000000003'
  )
on conflict (world_id, user_id) do nothing;

-- ---------------------------------------------------------------------------
-- Canonical Verdant Reach (world 101) nations preserved for Epic 2/3 fixtures.
-- ---------------------------------------------------------------------------
insert into
  public.nations (id, world_id, name, description, is_hidden)
values
  (
    '00000000-0000-0000-0000-000000000201',
    '00000000-0000-0000-0000-000000000101',
    'Kingdom of Ashvale',
    'Inland kingdom whose ledger halls coordinate the rotation of harvests and watchfires across the Reach.',
    false
  ),
  (
    '00000000-0000-0000-0000-000000000202',
    '00000000-0000-0000-0000-000000000101',
    'Free Coast of Tideholm',
    'Coastal league of harbour towns whose moots negotiate fishing rights and the long peace with their inland neighbours.',
    false
  ),
  (
    '00000000-0000-0000-0000-000000000203',
    '00000000-0000-0000-0000-000000000101',
    'Realm of Stoneridge',
    'Highland realm of stone-cutters and shepherds whose pacts with Ashvale outlived their last reigning queen.',
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
    'Walled market town that keeps the southern beacon-line; the readiness clerks here mark each turn by hand.',
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
    'River ford and toll-house whose clerks have yet to certify this turn''s readiness ledger.',
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
    'Hilltop hold whose standing council has voted to roll readiness forward automatically each turn.',
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
    'Headland fortress whose harbourmasters keep the long peace with Ashvale and the Realm of Stoneridge.',
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
    'Mountain capital of the Realm of Stoneridge, founded over a vein of pale granite.',
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
-- Verdant Reach (world 101) Epic 3 citizens, partnerships, relationships, and
-- active player characters.
--
-- Seed runs as the database superuser, so the column-level grants on
-- public.citizens (which lock direct writes to user_id and role_* for the
-- authenticated role) do not apply. The role-assignment and character-link
-- RPCs check auth.uid(), so they cannot be used from the seed.
-- ---------------------------------------------------------------------------
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

-- Stand-alone NPCs spread across the four canonical settlements with full
-- flavor populated. The two family parents below get their own insert so the
-- child row (whose parent FKs reference them) can be inserted in a separate
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
    'Died peacefully during the first winter after the founding.'
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
    'The pair parted after a long winter and were never reconciled.'
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
-- Linnford Concord (world 102) canonical nation, settlement, and citizen.
-- The per-world npc_flavor_config_json override above sets the flavor pool
-- this NPC draws from.
-- ---------------------------------------------------------------------------
insert into
  public.nations (id, world_id, name, description, is_hidden)
values
  (
    '00000000-0000-0000-0000-000000000211',
    '00000000-0000-0000-0000-000000000102',
    'Concord of Linn',
    'Federated river towns whose ledger clerks keep the Concord''s weekly almanac of canal tolls.',
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
    'River-mouth capital of the Concord of Linn, founded where the Linn meets the salt.',
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
-- Greyfell March (world 103) canonical nation, settlement, and citizen. The
-- per-world incest_prevention_depth override above keeps the sibling check on
-- but disables first-cousin and beyond.
-- ---------------------------------------------------------------------------
insert into
  public.nations (id, world_id, name, description, is_hidden)
values
  (
    '00000000-0000-0000-0000-000000000221',
    '00000000-0000-0000-0000-000000000103',
    'March of Greyfell',
    'Forest march whose warden families have held the same hill-forts since the founding of the line.',
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
    'Hill-fort capital of the March of Greyfell, perched above the old caravan road.',
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

-- ---------------------------------------------------------------------------
-- Bulk topology: fill each of the five worlds to twelve nations, each with
-- three settlements and at least one NPC, so demos and Epic 4–6 lists run on
-- a realistically populated corpus instead of the original fixture-only seed.
--
-- Deterministic UUID scheme — avoids collisions with the canonical fixture
-- rows above by using the third UUID group:
--   nations     '00000000-0000-0000-0001-' || lpad(W*100   + N            , 12, '0')
--   settlements '00000000-0000-0000-0002-' || lpad(W*10000 + N*100 + S    , 12, '0')
--   citizens    '00000000-0000-0000-0003-' || lpad(W*100000+ N*1000+ S*10 + P, 12, '0')
-- where W is the 1-based world index (1..5), N the 1-based nation index
-- (1..12), S the settlement index within the nation (1..3), and P the NPC
-- index within the settlement (1..2).
-- ---------------------------------------------------------------------------
do $$
declare
  v_world_ids constant uuid[] := array[
    '00000000-0000-0000-0000-000000000101'::uuid,
    '00000000-0000-0000-0000-000000000102'::uuid,
    '00000000-0000-0000-0000-000000000103'::uuid,
    '00000000-0000-0000-0000-000000000104'::uuid,
    '00000000-0000-0000-0000-000000000105'::uuid
  ];

  -- Bulk nation names, indexed [W][N] (1-based). Canonical positions in
  -- worlds 1–3 are left null; they are populated explicitly above.
  v_nation_names constant text[][] := array[
    array[
      null::text, null::text, null::text,
      'Brookmere League', 'Hollowfell County', 'Stormwatch Marches',
      'Greenshade Reach', 'Highmoor Demesne', 'Embervale Republic',
      'Northwood Principality', 'Saltreach Confederacy', 'Crownhill Protectorate'
    ],
    array[
      null::text,
      'Riverdown Cantons', 'Mosswold Reach', 'Skyhaven League',
      'Brackenford Marches', 'Wendover Burghs', 'Highford Principality',
      'Saltmarsh County', 'Norvale Federation', 'Goldenford Demesne',
      'Cresthollow Republic', 'Westwind Reach'
    ],
    array[
      null::text,
      'Verdant Pact', 'Tidewatch Holdings', 'Stonehill Republic',
      'Pinemoor County', 'Quartzfell March', 'Glasswater Reach',
      'Hollow Crest League', 'Wildreach Principality', 'Shadowmere Cantons',
      'Mossvale Demesne', 'Far Verdant Marches'
    ],
    array[
      'Hollowmere Crown', 'Salt Marsh Republic', 'Westerly Reach',
      'Anvil Ridge Marches', 'Brackmoor County', 'Loamfen Burghs',
      'Driftwood Federation', 'Hollow Crest Demesne', 'Stormwatch Cantons',
      'Tallwater March', 'Owl Hollow Demesne', 'Saltreach Pact'
    ],
    array[
      'Stormhold Crown', 'Ashfen Republic', 'Wyldwater Reach',
      'Brindlewood Marches', 'Sorrowford County', 'Highmark Burghs',
      'Coldhearth Federation', 'Mirewood Principality', 'Talonmere Cantons',
      'Frostgale March', 'Burnt Hollow Demesne', 'Ironreach Pact'
    ]
  ];

  -- Sixty settlement base words. The (W, N) slot picks a unique base, the
  -- settlement_idx 1..3 chooses a suffix so the three settlements under a
  -- single nation feel related but distinct.
  -- Five canonical settlements in Verdant Reach (Hearthwatch, Mistfall
  -- Crossing, Sunmere Hold, Tidewatch, Stonehold Keep) use the bases "Hearth",
  -- "Mist", "Sun", "Tide", and "Stone"; those bases are intentionally absent
  -- from the bulk pool so combined names like "Tidewatch" or "Hearthwatch"
  -- never duplicate the canonical settlement names in the same world.
  v_settlement_bases constant text[] := array[
    'Brook', 'Cedar', 'Aspen', 'Maple', 'Willow', 'Rowan', 'Hollow', 'Storm',
    'Green', 'High', 'Ember', 'Salt', 'Crown', 'Moss', 'Sky', 'Wend',
    'Gold', 'Crest', 'Pine', 'Quartz', 'Glass', 'Shadow', 'Anvil', 'Drift',
    'Owl', 'Ash', 'Brindle', 'Sorrow', 'Mark', 'Cold', 'Mire', 'Talon',
    'Frost', 'Iron', 'Far', 'Verdant', 'Long', 'Old', 'Black', 'White',
    'Red', 'Grey', 'Loam', 'Tall', 'Bridge', 'Fair', 'Field', 'Briar',
    'Birch', 'Hare', 'Yarrow', 'Linn', 'Cresswell', 'Holt', 'Burn', 'Spire',
    'Vale', 'Reed', 'Thorn', 'Hazel'
  ];
  v_settlement_suffixes constant text[] := array['watch', 'mere', 'fall'];

  -- NPC name pool — first names and surnames are cycled independently so 220
  -- bulk NPCs get distinguishable full names without hand-authoring.
  v_first_names constant text[] := array[
    'Aren', 'Bryn', 'Cora', 'Dain', 'Elsa', 'Faron', 'Gale', 'Hesper',
    'Ilse', 'Joren', 'Kenna', 'Loris', 'Mira', 'Nessa', 'Orin', 'Petra',
    'Quill', 'Roan', 'Senna', 'Tarek', 'Una', 'Vesper', 'Wren', 'Xanthe',
    'Yara', 'Zarek', 'Alric', 'Briga', 'Calder', 'Dara'
  ];
  v_last_names constant text[] := array[
    'Marrow', 'Quill', 'Bask', 'Auren', 'Pace', 'Reyne', 'Vale', 'Greyfell',
    'Wren', 'Holt', 'Brackmoor', 'Linnford', 'Hollowfell', 'Ashvale', 'Tideholm',
    'Stoneridge', 'Brindle', 'Embervale', 'Wendover', 'Cresswell', 'Norvale',
    'Saltmarsh', 'Sorrowford', 'Highmoor', 'Mosswold', 'Skyhaven', 'Driftwood',
    'Talonmere', 'Frostgale', 'Burnhollow'
  ];

  -- Default NPC flavor pool — matches the values returned by
  -- public.default_npc_flavor_config() so bulk NPCs in worlds 101/103/104/105
  -- pull from the same pool the UI surfaces.
  v_default_traits constant text[] := array[
    'earnest', 'wry', 'patient', 'haunted', 'boisterous'
  ];
  v_default_contradictions constant text[] := array[
    'mourns a friend they betrayed', 'loves their rival'
  ];
  v_default_goals constant text[] := array[
    'a seat on the council', 'to restore their family''s name'
  ];
  v_default_flaws constant text[] := array[
    'pride', 'envy', 'an addiction to risk'
  ];

  -- World 102 override pool — mirrors the npc_flavor_config_json override
  -- above so the Linnford Concord''s NPCs sit inside their custom pool.
  v_w102_traits constant text[] := array['bookish', 'stoic', 'needling'];
  v_w102_contradictions constant text[] := array[
    'secretly funds their rivals', 'writes sonnets they will never publish'
  ];
  v_w102_goals constant text[] := array[
    'map every uncharted coast', 'found a free school'
  ];
  v_w102_flaws constant text[] := array[
    'overconfidence in their own ledger work', 'hoards favors'
  ];

  v_world_idx integer;
  v_world_id uuid;
  v_nation_idx integer;
  v_nation_id uuid;
  v_nation_name text;
  v_settlement_idx integer;
  v_settlement_id uuid;
  v_settlement_name text;
  v_base_idx integer;
  v_npc_count integer;
  v_npc_idx integer;
  v_npc_id uuid;
  v_npc_name text;
  v_auto_ready boolean;
  v_is_ready boolean;
  v_ready_at timestamptz;
  v_trait1 text;
  v_trait2 text;
  v_contradiction text;
  v_goal text;
  v_flaw text;
  v_born integer;
  v_sex text;
begin
  for v_world_idx in 1..5 loop
    v_world_id := v_world_ids[v_world_idx];

    for v_nation_idx in 1..12 loop
      v_nation_name := v_nation_names[v_world_idx][v_nation_idx];

      -- Canonical fixture positions (worlds 1-3 slots 1, 1-3 slot 1, etc.)
      -- carry NULL in the name array and have already been inserted by the
      -- canonical blocks above.
      if v_nation_name is null then
        continue;
      end if;

      v_nation_id := (
        '00000000-0000-0000-0001-'
        || lpad((v_world_idx * 100 + v_nation_idx)::text, 12, '0')
      )::uuid;

      insert into public.nations (id, world_id, name, description, is_hidden)
      values (
        v_nation_id,
        v_world_id,
        v_nation_name,
        format(
          'Polity of the %s, whose council scribes file each turn''s ledger from their hill-hall.',
          v_nation_name
        ),
        false
      )
      on conflict (id) do update
      set
        world_id = excluded.world_id,
        name = excluded.name,
        description = excluded.description,
        is_hidden = excluded.is_hidden,
        updated_at = now();

      -- Base name shared across this nation's three settlements so they
      -- read as a related cluster; the base index uses the linear slot
      -- (W-1)*12 + (N-1), modulo the pool size to stay in range.
      v_base_idx := (((v_world_idx - 1) * 12) + (v_nation_idx - 1))
                    % array_length(v_settlement_bases, 1);

      for v_settlement_idx in 1..3 loop
        v_settlement_id := (
          '00000000-0000-0000-0002-'
          || lpad(
            (v_world_idx * 10000 + v_nation_idx * 100 + v_settlement_idx)::text,
            12,
            '0'
          )
        )::uuid;

        v_settlement_name := v_settlement_bases[v_base_idx + 1]
                             || v_settlement_suffixes[v_settlement_idx];

        -- Cycle readiness state by (nation + settlement) so every world's
        -- bulk settlements include manual-ready, auto-ready, and not-ready
        -- examples and the readiness summary panels stay non-trivial.
        case ((v_nation_idx + v_settlement_idx) % 3)
          when 0 then
            v_auto_ready := false;
            v_is_ready := false;
            v_ready_at := null;
          when 1 then
            v_auto_ready := false;
            v_is_ready := true;
            v_ready_at := '2026-05-03 12:00:00+00'::timestamptz;
          else
            v_auto_ready := true;
            v_is_ready := false;
            v_ready_at := null;
        end case;

        insert into public.settlements (
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
        values (
          v_settlement_id,
          v_nation_id,
          v_settlement_name,
          format(
            'Settlement of the %s, in the lee of the %s ridge.',
            v_nation_name,
            v_settlement_bases[v_base_idx + 1]
          ),
          (
            ((v_world_idx - 3) * 90)
            + ((v_nation_idx - 6) * 12)
            + ((v_settlement_idx - 2) * 4)
          )::numeric(18, 4),
          (
            ((v_nation_idx - 6) * 10)
            + ((v_world_idx - 3) * 25)
            + ((v_settlement_idx - 2) * 3)
          )::numeric(18, 4),
          v_auto_ready,
          v_is_ready,
          case when v_is_ready then v_ready_at end,
          case when v_is_ready then v_ready_at end,
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

        -- Two NPCs in the first settlement of each nation, one in the rest:
        -- gives ~220 bulk NPCs while keeping the seed file size sane.
        v_npc_count := case when v_settlement_idx = 1 then 2 else 1 end;

        for v_npc_idx in 1..v_npc_count loop
          v_npc_id := (
            '00000000-0000-0000-0003-'
            || lpad(
              (
                v_world_idx * 100000
                + v_nation_idx * 1000
                + v_settlement_idx * 10
                + v_npc_idx
              )::text,
              12,
              '0'
            )
          )::uuid;

          v_npc_name := format(
            '%s %s',
            v_first_names[
              (
                (
                  v_world_idx * 31
                  + v_nation_idx * 13
                  + v_settlement_idx * 7
                  + v_npc_idx * 3
                )
                % array_length(v_first_names, 1)
              ) + 1
            ],
            v_last_names[
              (
                (
                  v_world_idx * 17
                  + v_nation_idx * 11
                  + v_settlement_idx * 5
                  + v_npc_idx * 19
                )
                % array_length(v_last_names, 1)
              ) + 1
            ]
          );

          if v_world_idx = 2 then
            v_trait1 := v_w102_traits[
              ((v_nation_idx + v_settlement_idx + v_npc_idx)
                % array_length(v_w102_traits, 1)) + 1
            ];
            v_trait2 := v_w102_traits[
              ((v_nation_idx + v_settlement_idx * 2 + v_npc_idx)
                % array_length(v_w102_traits, 1)) + 1
            ];
            v_contradiction := v_w102_contradictions[
              ((v_nation_idx + v_npc_idx)
                % array_length(v_w102_contradictions, 1)) + 1
            ];
            v_goal := v_w102_goals[
              ((v_nation_idx + v_settlement_idx)
                % array_length(v_w102_goals, 1)) + 1
            ];
            v_flaw := v_w102_flaws[
              ((v_settlement_idx + v_npc_idx)
                % array_length(v_w102_flaws, 1)) + 1
            ];
          else
            v_trait1 := v_default_traits[
              ((v_nation_idx + v_settlement_idx + v_npc_idx)
                % array_length(v_default_traits, 1)) + 1
            ];
            v_trait2 := v_default_traits[
              ((v_nation_idx + v_settlement_idx * 2 + v_npc_idx + 1)
                % array_length(v_default_traits, 1)) + 1
            ];
            v_contradiction := v_default_contradictions[
              ((v_nation_idx + v_npc_idx)
                % array_length(v_default_contradictions, 1)) + 1
            ];
            v_goal := v_default_goals[
              ((v_nation_idx + v_settlement_idx)
                % array_length(v_default_goals, 1)) + 1
            ];
            v_flaw := v_default_flaws[
              ((v_settlement_idx + v_npc_idx + v_world_idx)
                % array_length(v_default_flaws, 1)) + 1
            ];
          end if;

          v_born := -20
                    - ((v_world_idx * 7 + v_nation_idx * 3 + v_settlement_idx
                        + v_npc_idx * 5) % 40);
          v_sex := case
                     when ((v_nation_idx + v_settlement_idx + v_npc_idx) % 2) = 0
                       then 'female'
                     else 'male'
                   end;

          insert into public.citizens (
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
          values (
            v_npc_id,
            v_world_id,
            v_settlement_id,
            'npc',
            v_npc_name,
            v_sex,
            'alive',
            v_born,
            v_trait1,
            v_trait2,
            v_contradiction,
            v_goal,
            v_flaw
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
        end loop;
      end loop;
    end loop;
  end loop;
end$$;
