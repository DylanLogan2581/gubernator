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
-- Worlds 101/103/104/105 share an expanded "default" flavor pool so the NPC
-- preview renders with broad variety. World 102 keeps its distinct Linnford
-- Concord flavor — also expanded — so the override path stays exercised.
update public.worlds
set
  npc_flavor_config_json = '{
    "traits": [
      "earnest", "wry", "patient", "haunted", "boisterous",
      "stoic", "tender", "shrewd", "blunt", "watchful",
      "scrappy", "courtly", "weary", "fervent", "soft-spoken"
    ],
    "contradictions": [
      "mourns a friend they betrayed",
      "loves their rival",
      "writes letters to a god they no longer trust",
      "keeps a child''s portrait they have never named",
      "holds a vow they cannot remember swearing",
      "shelters the family of a soldier they killed",
      "owes a debt to the very people they hunt",
      "hides a wound that should have killed them"
    ],
    "goals": [
      "a seat on the council",
      "to restore their family''s name",
      "to walk the south road one more time",
      "to read the unburned half of the library",
      "to outlive every captain they ever served",
      "to apprentice a child of the lower ward",
      "to see the long winter season end",
      "to pay back the gold lender of Mistfall",
      "to bring back the standing stones their grandfather raised",
      "to die at home and not on the road"
    ],
    "flaws": [
      "pride",
      "envy",
      "an addiction to risk",
      "a slow drinking habit kept quiet at court",
      "an inability to forgive the dead",
      "a temper that comes out in writing",
      "a need to be the cleverest voice in the room",
      "miserliness with their own household",
      "a tendency to read every silence as betrayal",
      "the certainty that they alone can hold the line"
    ]
  }'::jsonb
where
  id in (
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000103',
    '00000000-0000-0000-0000-000000000104',
    '00000000-0000-0000-0000-000000000105'
  );

update public.worlds
set
  npc_flavor_config_json = '{
    "traits": [
      "bookish", "stoic", "needling", "exacting", "ironic",
      "self-deprecating", "patrician", "wry", "ardent", "cool-headed",
      "fastidious", "diplomatic", "incisive", "softly furious", "literary"
    ],
    "contradictions": [
      "secretly funds their rivals",
      "writes sonnets they will never publish",
      "keeps a forbidden correspondence with a city across the salt",
      "rereads a confession they never sent",
      "tutors the heir of a house they helped exile",
      "endows a charity in the name of a man they ruined",
      "argues both sides of every motion in private",
      "votes against their own family''s interests when nobody is watching"
    ],
    "goals": [
      "map every uncharted coast",
      "found a free school",
      "rewrite the Concord''s water charter",
      "compile a definitive lexicon of the river dialects",
      "earn a seat on the Inner Canal Bench",
      "annex the abandoned canal lock at Mossvale",
      "translate the southern philosophers in their lifetime",
      "abolish the toll on the river''s lower mouths",
      "secure a printing press for the public library",
      "die at their desk with the last page complete"
    ],
    "flaws": [
      "overconfidence in their own ledger work",
      "hoards favors",
      "a horror of being misquoted",
      "an unwillingness to delegate even trivial work",
      "a tendency to lecture instead of listen",
      "a fondness for arguments they already plan to lose",
      "a habit of forgetting names beneath their own rank",
      "a pedantic streak that surfaces under stress",
      "a quiet contempt for the unread",
      "a private dread of being thought provincial"
    ]
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

  -- Default NPC flavor pool — mirrors the expanded npc_flavor_config_json
  -- override applied above to worlds 101/103/104/105, so bulk NPCs in those
  -- worlds pull from the same pool the UI surfaces.
  v_default_traits constant text[] := array[
    'earnest', 'wry', 'patient', 'haunted', 'boisterous',
    'stoic', 'tender', 'shrewd', 'blunt', 'watchful',
    'scrappy', 'courtly', 'weary', 'fervent', 'soft-spoken'
  ];
  v_default_contradictions constant text[] := array[
    'mourns a friend they betrayed',
    'loves their rival',
    'writes letters to a god they no longer trust',
    'keeps a child''s portrait they have never named',
    'holds a vow they cannot remember swearing',
    'shelters the family of a soldier they killed',
    'owes a debt to the very people they hunt',
    'hides a wound that should have killed them'
  ];
  v_default_goals constant text[] := array[
    'a seat on the council',
    'to restore their family''s name',
    'to walk the south road one more time',
    'to read the unburned half of the library',
    'to outlive every captain they ever served',
    'to apprentice a child of the lower ward',
    'to see the long winter season end',
    'to pay back the gold lender of Mistfall',
    'to bring back the standing stones their grandfather raised',
    'to die at home and not on the road'
  ];
  v_default_flaws constant text[] := array[
    'pride',
    'envy',
    'an addiction to risk',
    'a slow drinking habit kept quiet at court',
    'an inability to forgive the dead',
    'a temper that comes out in writing',
    'a need to be the cleverest voice in the room',
    'miserliness with their own household',
    'a tendency to read every silence as betrayal',
    'the certainty that they alone can hold the line'
  ];

  -- World 102 override pool — mirrors the expanded npc_flavor_config_json
  -- override above so the Linnford Concord''s NPCs sit inside their custom pool.
  v_w102_traits constant text[] := array[
    'bookish', 'stoic', 'needling', 'exacting', 'ironic',
    'self-deprecating', 'patrician', 'wry', 'ardent', 'cool-headed',
    'fastidious', 'diplomatic', 'incisive', 'softly furious', 'literary'
  ];
  v_w102_contradictions constant text[] := array[
    'secretly funds their rivals',
    'writes sonnets they will never publish',
    'keeps a forbidden correspondence with a city across the salt',
    'rereads a confession they never sent',
    'tutors the heir of a house they helped exile',
    'endows a charity in the name of a man they ruined',
    'argues both sides of every motion in private',
    'votes against their own family''s interests when nobody is watching'
  ];
  v_w102_goals constant text[] := array[
    'map every uncharted coast',
    'found a free school',
    'rewrite the Concord''s water charter',
    'compile a definitive lexicon of the river dialects',
    'earn a seat on the Inner Canal Bench',
    'annex the abandoned canal lock at Mossvale',
    'translate the southern philosophers in their lifetime',
    'abolish the toll on the river''s lower mouths',
    'secure a printing press for the public library',
    'die at their desk with the last page complete'
  ];
  v_w102_flaws constant text[] := array[
    'overconfidence in their own ledger work',
    'hoards favors',
    'a horror of being misquoted',
    'an unwillingness to delegate even trivial work',
    'a tendency to lecture instead of listen',
    'a fondness for arguments they already plan to lose',
    'a habit of forgetting names beneath their own rank',
    'a pedantic streak that surfaces under stress',
    'a quiet contempt for the unread',
    'a private dread of being thought provincial'
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

-- ---------------------------------------------------------------------------
-- Epic 4 world-settings pack: every seeded world receives the same canonical
-- pack of non-system resources, jobs (covering every job_type), deposit types,
-- managed population types, and building blueprints with at least one
-- populated tier each. Per-world UUIDs are derived deterministically so the
-- pack is idempotent across `supabase db reset`.
--
-- Deterministic UUID scheme (third UUID group reserved for Epic 4 entities):
--   resources   '00000000-0000-0000-0004-' || lpad(W*100  + R, 12, '0')
--   jobs        '00000000-0000-0000-0005-' || lpad(W*100  + J, 12, '0')
--   blueprints  '00000000-0000-0000-0006-' || lpad(W*100  + B, 12, '0')
--   tiers       '00000000-0000-0000-0007-' || lpad(W*1000 + B*10 + T, 12, '0')
--   deposits    '00000000-0000-0000-0008-' || lpad(W*100  + D, 12, '0')
--   pops        '00000000-0000-0000-0009-' || lpad(W*100  + P, 12, '0')
-- where W is the 1-based world index (1..5) and the other counters are
-- 1-based slots within that world.
--
-- Ordering inside the DO block:
--   1. resources                              (referenced by everything below)
--   2. job_definitions                        (deposit/managed-pop FKs are
--      DEFERRABLE INITIALLY DEFERRED, so jobs may set linked_* before the
--      target rows exist; the constraint is validated at end of the DO block)
--   3. deposit_types                          (FK target for jobs.linked_deposit_type_id)
--   4. managed_population_types               (FK target for jobs.linked_managed_population_type_id)
--   5. building_blueprints                    (parents of tiers below)
--   6. building_blueprint_tiers               (validates JSON references at
--      INSERT via a BEFORE trigger; needs resources + jobs to exist live)
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

  v_world_idx integer;
  v_world_id uuid;

  -- Resources (11 per world)
  v_res_grain uuid;
  v_res_salted_pork uuid;
  v_res_smoked_mutton uuid;
  v_res_honey uuid;
  v_res_beer uuid;
  v_res_linen_cloth uuid;
  v_res_wool uuid;
  v_res_hardwood_logs uuid;
  v_res_stone_block uuid;
  v_res_iron_ore uuid;
  v_res_copper_ingot uuid;

  -- Jobs (15 per world; one or more of every job_type)
  v_job_grain_farmer uuid;
  v_job_cloth_weaver uuid;
  v_job_brewer uuid;
  v_job_stone_mason uuid;
  v_job_caravan_trader uuid;
  v_job_iron_miner uuid;
  v_job_copper_miner uuid;
  v_job_stone_quarryman uuid;
  v_job_lumberjack uuid;
  v_job_shepherd uuid;
  v_job_beekeeper uuid;
  v_job_swineherd uuid;
  v_job_mutton_butcher uuid;
  v_job_honey_gatherer uuid;
  v_job_pork_butcher uuid;

  -- Deposit types (4 per world)
  v_dep_iron_vein uuid;
  v_dep_copper_vein uuid;
  v_dep_stone_quarry uuid;
  v_dep_hardwood_grove uuid;

  -- Managed population types (3 per world)
  v_pop_sheep_herd uuid;
  v_pop_bee_colony uuid;
  v_pop_pig_herd uuid;

  -- Blueprints (5 per world) and their tiers
  v_bp_farmstead uuid;
  v_bp_storehouse uuid;
  v_bp_workshop uuid;
  v_bp_longhouse uuid;
  v_bp_smithy uuid;
  v_tier_farmstead_1 uuid;
  v_tier_storehouse_1 uuid;
  v_tier_workshop_1 uuid;
  v_tier_longhouse_1 uuid;
  v_tier_smithy_1 uuid;
  v_tier_smithy_2 uuid;
begin
  for v_world_idx in 1..5 loop
    v_world_id := v_world_ids[v_world_idx];

    -- Per-world deterministic UUIDs ------------------------------------------
    v_res_grain         := ('00000000-0000-0000-0004-' || lpad((v_world_idx * 100 +  1)::text, 12, '0'))::uuid;
    v_res_salted_pork   := ('00000000-0000-0000-0004-' || lpad((v_world_idx * 100 +  2)::text, 12, '0'))::uuid;
    v_res_smoked_mutton := ('00000000-0000-0000-0004-' || lpad((v_world_idx * 100 +  3)::text, 12, '0'))::uuid;
    v_res_honey         := ('00000000-0000-0000-0004-' || lpad((v_world_idx * 100 +  4)::text, 12, '0'))::uuid;
    v_res_beer          := ('00000000-0000-0000-0004-' || lpad((v_world_idx * 100 +  5)::text, 12, '0'))::uuid;
    v_res_linen_cloth   := ('00000000-0000-0000-0004-' || lpad((v_world_idx * 100 +  6)::text, 12, '0'))::uuid;
    v_res_wool          := ('00000000-0000-0000-0004-' || lpad((v_world_idx * 100 +  7)::text, 12, '0'))::uuid;
    v_res_hardwood_logs := ('00000000-0000-0000-0004-' || lpad((v_world_idx * 100 +  8)::text, 12, '0'))::uuid;
    v_res_stone_block   := ('00000000-0000-0000-0004-' || lpad((v_world_idx * 100 +  9)::text, 12, '0'))::uuid;
    v_res_iron_ore      := ('00000000-0000-0000-0004-' || lpad((v_world_idx * 100 + 10)::text, 12, '0'))::uuid;
    v_res_copper_ingot  := ('00000000-0000-0000-0004-' || lpad((v_world_idx * 100 + 11)::text, 12, '0'))::uuid;

    v_job_grain_farmer    := ('00000000-0000-0000-0005-' || lpad((v_world_idx * 100 +  1)::text, 12, '0'))::uuid;
    v_job_cloth_weaver    := ('00000000-0000-0000-0005-' || lpad((v_world_idx * 100 +  2)::text, 12, '0'))::uuid;
    v_job_brewer          := ('00000000-0000-0000-0005-' || lpad((v_world_idx * 100 +  3)::text, 12, '0'))::uuid;
    v_job_stone_mason     := ('00000000-0000-0000-0005-' || lpad((v_world_idx * 100 +  4)::text, 12, '0'))::uuid;
    v_job_caravan_trader  := ('00000000-0000-0000-0005-' || lpad((v_world_idx * 100 +  5)::text, 12, '0'))::uuid;
    v_job_iron_miner      := ('00000000-0000-0000-0005-' || lpad((v_world_idx * 100 +  6)::text, 12, '0'))::uuid;
    v_job_copper_miner    := ('00000000-0000-0000-0005-' || lpad((v_world_idx * 100 +  7)::text, 12, '0'))::uuid;
    v_job_stone_quarryman := ('00000000-0000-0000-0005-' || lpad((v_world_idx * 100 +  8)::text, 12, '0'))::uuid;
    v_job_lumberjack      := ('00000000-0000-0000-0005-' || lpad((v_world_idx * 100 +  9)::text, 12, '0'))::uuid;
    v_job_shepherd        := ('00000000-0000-0000-0005-' || lpad((v_world_idx * 100 + 10)::text, 12, '0'))::uuid;
    v_job_beekeeper       := ('00000000-0000-0000-0005-' || lpad((v_world_idx * 100 + 11)::text, 12, '0'))::uuid;
    v_job_swineherd       := ('00000000-0000-0000-0005-' || lpad((v_world_idx * 100 + 12)::text, 12, '0'))::uuid;
    v_job_mutton_butcher  := ('00000000-0000-0000-0005-' || lpad((v_world_idx * 100 + 13)::text, 12, '0'))::uuid;
    v_job_honey_gatherer  := ('00000000-0000-0000-0005-' || lpad((v_world_idx * 100 + 14)::text, 12, '0'))::uuid;
    v_job_pork_butcher    := ('00000000-0000-0000-0005-' || lpad((v_world_idx * 100 + 15)::text, 12, '0'))::uuid;

    v_dep_iron_vein      := ('00000000-0000-0000-0008-' || lpad((v_world_idx * 100 + 1)::text, 12, '0'))::uuid;
    v_dep_copper_vein    := ('00000000-0000-0000-0008-' || lpad((v_world_idx * 100 + 2)::text, 12, '0'))::uuid;
    v_dep_stone_quarry   := ('00000000-0000-0000-0008-' || lpad((v_world_idx * 100 + 3)::text, 12, '0'))::uuid;
    v_dep_hardwood_grove := ('00000000-0000-0000-0008-' || lpad((v_world_idx * 100 + 4)::text, 12, '0'))::uuid;

    v_pop_sheep_herd := ('00000000-0000-0000-0009-' || lpad((v_world_idx * 100 + 1)::text, 12, '0'))::uuid;
    v_pop_bee_colony := ('00000000-0000-0000-0009-' || lpad((v_world_idx * 100 + 2)::text, 12, '0'))::uuid;
    v_pop_pig_herd   := ('00000000-0000-0000-0009-' || lpad((v_world_idx * 100 + 3)::text, 12, '0'))::uuid;

    v_bp_farmstead  := ('00000000-0000-0000-0006-' || lpad((v_world_idx * 100 + 1)::text, 12, '0'))::uuid;
    v_bp_storehouse := ('00000000-0000-0000-0006-' || lpad((v_world_idx * 100 + 2)::text, 12, '0'))::uuid;
    v_bp_workshop   := ('00000000-0000-0000-0006-' || lpad((v_world_idx * 100 + 3)::text, 12, '0'))::uuid;
    v_bp_longhouse  := ('00000000-0000-0000-0006-' || lpad((v_world_idx * 100 + 4)::text, 12, '0'))::uuid;
    v_bp_smithy     := ('00000000-0000-0000-0006-' || lpad((v_world_idx * 100 + 5)::text, 12, '0'))::uuid;

    v_tier_farmstead_1  := ('00000000-0000-0000-0007-' || lpad((v_world_idx * 1000 + 1 * 10 + 1)::text, 12, '0'))::uuid;
    v_tier_storehouse_1 := ('00000000-0000-0000-0007-' || lpad((v_world_idx * 1000 + 2 * 10 + 1)::text, 12, '0'))::uuid;
    v_tier_workshop_1   := ('00000000-0000-0000-0007-' || lpad((v_world_idx * 1000 + 3 * 10 + 1)::text, 12, '0'))::uuid;
    v_tier_longhouse_1  := ('00000000-0000-0000-0007-' || lpad((v_world_idx * 1000 + 4 * 10 + 1)::text, 12, '0'))::uuid;
    v_tier_smithy_1     := ('00000000-0000-0000-0007-' || lpad((v_world_idx * 1000 + 5 * 10 + 1)::text, 12, '0'))::uuid;
    v_tier_smithy_2     := ('00000000-0000-0000-0007-' || lpad((v_world_idx * 1000 + 5 * 10 + 2)::text, 12, '0'))::uuid;

    -- 1. Resources --------------------------------------------------------
    insert into public.resources (id, world_id, name, slug, base_stockpile_cap)
    values
      (v_res_grain,         v_world_id, 'Grain',         'grain',          1000),
      (v_res_salted_pork,   v_world_id, 'Salted Pork',   'salted-pork',     500),
      (v_res_smoked_mutton, v_world_id, 'Smoked Mutton', 'smoked-mutton',   500),
      (v_res_honey,         v_world_id, 'Honey',         'honey',           200),
      (v_res_beer,          v_world_id, 'Beer',          'beer',            300),
      (v_res_linen_cloth,   v_world_id, 'Linen Cloth',   'linen-cloth',     300),
      (v_res_wool,          v_world_id, 'Wool',          'wool',            400),
      (v_res_hardwood_logs, v_world_id, 'Hardwood Logs', 'hardwood-logs',   800),
      (v_res_stone_block,   v_world_id, 'Stone Block',   'stone-block',    1000),
      (v_res_iron_ore,      v_world_id, 'Iron Ore',      'iron-ore',        600),
      (v_res_copper_ingot,  v_world_id, 'Copper Ingot',  'copper-ingot',    400)
    on conflict (world_id, slug) do update
    set
      name = excluded.name,
      base_stockpile_cap = excluded.base_stockpile_cap,
      is_trashed = false,
      updated_at = now();

    -- 2. Jobs -------------------------------------------------------------
    -- Standard producers/consumers that exercise inputs and outputs.
    insert into public.job_definitions (
      id, world_id, name, slug, job_type, base_capacity,
      inputs_json, outputs_json
    )
    values
      (
        v_job_grain_farmer, v_world_id, 'Grain Farmer', 'grain-farmer',
        'standard', 8,
        '[]'::jsonb,
        jsonb_build_array(
          jsonb_build_object('resource_id', v_res_grain::text, 'amount_per_worker', 2)
        )
      ),
      (
        v_job_cloth_weaver, v_world_id, 'Cloth Weaver', 'cloth-weaver',
        'standard', 6,
        jsonb_build_array(
          jsonb_build_object('resource_id', v_res_wool::text, 'amount_per_worker', 2)
        ),
        jsonb_build_array(
          jsonb_build_object('resource_id', v_res_linen_cloth::text, 'amount_per_worker', 1)
        )
      ),
      (
        v_job_brewer, v_world_id, 'Brewer', 'brewer',
        'standard', 5,
        jsonb_build_array(
          jsonb_build_object('resource_id', v_res_grain::text, 'amount_per_worker', 2),
          jsonb_build_object('resource_id', v_res_honey::text, 'amount_per_worker', 0.5)
        ),
        jsonb_build_array(
          jsonb_build_object('resource_id', v_res_beer::text, 'amount_per_worker', 1)
        )
      ),
      (
        v_job_stone_mason, v_world_id, 'Stone Mason', 'stone-mason',
        'construction', 4,
        '[]'::jsonb,
        '[]'::jsonb
      )
    on conflict (world_id, slug) do update
    set
      name = excluded.name,
      job_type = excluded.job_type,
      base_capacity = excluded.base_capacity,
      inputs_json = excluded.inputs_json,
      outputs_json = excluded.outputs_json,
      is_trashed = false,
      updated_at = now();

    -- Trader. trader_capacity_per_worker is required for trader.
    insert into public.job_definitions (
      id, world_id, name, slug, job_type, trader_capacity_per_worker
    )
    values
      (
        v_job_caravan_trader, v_world_id, 'Caravan Trader', 'caravan-trader',
        'trader', 3
      )
    on conflict (world_id, slug) do update
    set
      name = excluded.name,
      job_type = excluded.job_type,
      trader_capacity_per_worker = excluded.trader_capacity_per_worker,
      is_trashed = false,
      updated_at = now();

    -- Deposit jobs. linked_deposit_type_id resolves via DEFERRABLE INITIALLY
    -- DEFERRED FK at the end of this DO block once the deposit_types rows
    -- below have been inserted.
    insert into public.job_definitions (
      id, world_id, name, slug, job_type, linked_deposit_type_id,
      inputs_json, outputs_json
    )
    values
      (
        v_job_iron_miner, v_world_id, 'Iron Miner', 'iron-miner',
        'deposit', v_dep_iron_vein,
        '[]'::jsonb, '[]'::jsonb
      ),
      (
        v_job_copper_miner, v_world_id, 'Copper Miner', 'copper-miner',
        'deposit', v_dep_copper_vein,
        '[]'::jsonb, '[]'::jsonb
      ),
      (
        v_job_stone_quarryman, v_world_id, 'Stone Quarryman', 'stone-quarryman',
        'deposit', v_dep_stone_quarry,
        '[]'::jsonb, '[]'::jsonb
      ),
      (
        v_job_lumberjack, v_world_id, 'Lumberjack', 'lumberjack',
        'deposit', v_dep_hardwood_grove,
        '[]'::jsonb, '[]'::jsonb
      )
    on conflict (world_id, slug) do update
    set
      name = excluded.name,
      job_type = excluded.job_type,
      linked_deposit_type_id = excluded.linked_deposit_type_id,
      inputs_json = excluded.inputs_json,
      outputs_json = excluded.outputs_json,
      is_trashed = false,
      updated_at = now();

    -- Husbandry and culling jobs. linked_managed_population_type_id resolves
    -- via DEFERRABLE INITIALLY DEFERRED FK once managed_population_types are
    -- inserted below.
    insert into public.job_definitions (
      id, world_id, name, slug, job_type, linked_managed_population_type_id,
      inputs_json, outputs_json
    )
    values
      (
        v_job_shepherd, v_world_id, 'Shepherd', 'shepherd',
        'husbandry', v_pop_sheep_herd,
        '[]'::jsonb, '[]'::jsonb
      ),
      (
        v_job_beekeeper, v_world_id, 'Beekeeper', 'beekeeper',
        'husbandry', v_pop_bee_colony,
        '[]'::jsonb, '[]'::jsonb
      ),
      (
        v_job_swineherd, v_world_id, 'Swineherd', 'swineherd',
        'husbandry', v_pop_pig_herd,
        '[]'::jsonb, '[]'::jsonb
      ),
      (
        v_job_mutton_butcher, v_world_id, 'Mutton Butcher', 'mutton-butcher',
        'culling', v_pop_sheep_herd,
        '[]'::jsonb, '[]'::jsonb
      ),
      (
        v_job_honey_gatherer, v_world_id, 'Honey Gatherer', 'honey-gatherer',
        'culling', v_pop_bee_colony,
        '[]'::jsonb, '[]'::jsonb
      ),
      (
        v_job_pork_butcher, v_world_id, 'Pork Butcher', 'pork-butcher',
        'culling', v_pop_pig_herd,
        '[]'::jsonb, '[]'::jsonb
      )
    on conflict (world_id, slug) do update
    set
      name = excluded.name,
      job_type = excluded.job_type,
      linked_managed_population_type_id = excluded.linked_managed_population_type_id,
      inputs_json = excluded.inputs_json,
      outputs_json = excluded.outputs_json,
      is_trashed = false,
      updated_at = now();

    -- 3. Deposit types ----------------------------------------------------
    insert into public.deposit_types (
      id, world_id, name, slug, job_id,
      output_units_per_worker, worker_inputs_json
    )
    values
      (
        v_dep_iron_vein, v_world_id, 'Iron Vein', 'iron-vein', v_job_iron_miner,
        5,
        jsonb_build_array(
          jsonb_build_object('resource_id', v_res_linen_cloth::text, 'amount_per_worker', 0.5)
        )
      ),
      (
        v_dep_copper_vein, v_world_id, 'Copper Vein', 'copper-vein', v_job_copper_miner,
        4,
        '[]'::jsonb
      ),
      (
        v_dep_stone_quarry, v_world_id, 'Stone Quarry', 'stone-quarry', v_job_stone_quarryman,
        8,
        jsonb_build_array(
          jsonb_build_object('resource_id', v_res_hardwood_logs::text, 'amount_per_worker', 0.5)
        )
      ),
      (
        v_dep_hardwood_grove, v_world_id, 'Hardwood Grove', 'hardwood-grove', v_job_lumberjack,
        6,
        '[]'::jsonb
      )
    on conflict (world_id, slug) do update
    set
      name = excluded.name,
      job_id = excluded.job_id,
      output_units_per_worker = excluded.output_units_per_worker,
      worker_inputs_json = excluded.worker_inputs_json,
      is_trashed = false,
      updated_at = now();

    -- 4. Managed population types -----------------------------------------
    insert into public.managed_population_types (
      id, world_id, name, slug,
      husbandry_job_id, culling_job_id,
      husbandry_workers_per_n_animals, growth_rate,
      maintenance_rules_json, culling_outputs_json
    )
    values
      (
        v_pop_sheep_herd, v_world_id, 'Sheep Herd', 'sheep-herd',
        v_job_shepherd, v_job_mutton_butcher,
        10, 0.1,
        jsonb_build_array(
          jsonb_build_object('resource_id', v_res_grain::text, 'amount_per_n_animals', 0.5)
        ),
        jsonb_build_array(
          jsonb_build_object('resource_id', v_res_wool::text, 'amount_per_n_animals', 1),
          jsonb_build_object('resource_id', v_res_smoked_mutton::text, 'amount_per_n_animals', 0.5)
        )
      ),
      (
        v_pop_bee_colony, v_world_id, 'Bee Colony', 'bee-colony',
        v_job_beekeeper, v_job_honey_gatherer,
        20, 0.05,
        '[]'::jsonb,
        jsonb_build_array(
          jsonb_build_object('resource_id', v_res_honey::text, 'amount_per_n_animals', 2)
        )
      ),
      (
        v_pop_pig_herd, v_world_id, 'Pig Herd', 'pig-herd',
        v_job_swineherd, v_job_pork_butcher,
        8, 0.15,
        jsonb_build_array(
          jsonb_build_object('resource_id', v_res_grain::text, 'amount_per_n_animals', 1)
        ),
        jsonb_build_array(
          jsonb_build_object('resource_id', v_res_salted_pork::text, 'amount_per_n_animals', 2)
        )
      )
    on conflict (world_id, slug) do update
    set
      name = excluded.name,
      husbandry_job_id = excluded.husbandry_job_id,
      culling_job_id = excluded.culling_job_id,
      husbandry_workers_per_n_animals = excluded.husbandry_workers_per_n_animals,
      growth_rate = excluded.growth_rate,
      maintenance_rules_json = excluded.maintenance_rules_json,
      culling_outputs_json = excluded.culling_outputs_json,
      is_trashed = false,
      updated_at = now();

    -- 5. Building blueprints ----------------------------------------------
    insert into public.building_blueprints (
      id, world_id, name, slug, description,
      grace_period_turns, max_instances_per_settlement
    )
    values
      (
        v_bp_farmstead, v_world_id, 'Farmstead', 'farmstead',
        'A walled farm complex anchoring the grain rotation around each settlement.',
        0, null
      ),
      (
        v_bp_storehouse, v_world_id, 'Storehouse', 'storehouse',
        'Roofed storage adding stockpile capacity for grain and salted goods.',
        1, 3
      ),
      (
        v_bp_workshop, v_world_id, 'Weaver''s Workshop', 'weavers-workshop',
        'A purpose-built workshop where weavers raise the settlement''s cloth output.',
        0, 4
      ),
      (
        v_bp_longhouse, v_world_id, 'Longhouse', 'longhouse',
        'A communal hall that raises the settlement''s sustainable population.',
        2, 6
      ),
      (
        v_bp_smithy, v_world_id, 'Smithy', 'smithy',
        'A two-tier smithy that expands iron storage and bolsters the mason corps.',
        1, 2
      )
    on conflict (world_id, slug) do update
    set
      name = excluded.name,
      description = excluded.description,
      grace_period_turns = excluded.grace_period_turns,
      max_instances_per_settlement = excluded.max_instances_per_settlement,
      is_trashed = false,
      updated_at = now();

    -- 6. Building blueprint tiers ----------------------------------------
    -- Validation BEFORE trigger checks resource_id / job_id references at
    -- INSERT time, so resources and jobs must already be live (above).
    insert into public.building_blueprint_tiers (
      id, building_blueprint_id, tier_number, worker_turns_required,
      construction_costs_json, upkeep_costs_json, effects_json
    )
    values
      (
        v_tier_farmstead_1, v_bp_farmstead, 1, 6,
        jsonb_build_array(
          jsonb_build_object('resource_id', v_res_stone_block::text,   'amount', 10),
          jsonb_build_object('resource_id', v_res_hardwood_logs::text, 'amount',  5)
        ),
        jsonb_build_array(
          jsonb_build_object('resource_id', v_res_grain::text, 'amount', 1)
        ),
        jsonb_build_array(
          jsonb_build_object('type', 'passive_resource_production',
                             'resource_id', v_res_grain::text, 'amount', 2),
          jsonb_build_object('type', 'job_capacity_increase',
                             'job_id', v_job_grain_farmer::text, 'amount', 2)
        )
      ),
      (
        v_tier_storehouse_1, v_bp_storehouse, 1, 4,
        jsonb_build_array(
          jsonb_build_object('resource_id', v_res_stone_block::text, 'amount', 20)
        ),
        '[]'::jsonb,
        jsonb_build_array(
          jsonb_build_object('type', 'resource_storage_increase',
                             'resource_id', v_res_grain::text,       'amount', 500),
          jsonb_build_object('type', 'resource_storage_increase',
                             'resource_id', v_res_salted_pork::text, 'amount', 250)
        )
      ),
      (
        v_tier_workshop_1, v_bp_workshop, 1, 5,
        jsonb_build_array(
          jsonb_build_object('resource_id', v_res_hardwood_logs::text, 'amount', 8),
          jsonb_build_object('resource_id', v_res_stone_block::text,   'amount', 4)
        ),
        '[]'::jsonb,
        jsonb_build_array(
          jsonb_build_object('type', 'job_capacity_increase',
                             'job_id', v_job_cloth_weaver::text, 'amount', 3)
        )
      ),
      (
        v_tier_longhouse_1, v_bp_longhouse, 1, 8,
        jsonb_build_array(
          jsonb_build_object('resource_id', v_res_hardwood_logs::text, 'amount', 15),
          jsonb_build_object('resource_id', v_res_stone_block::text,   'amount', 10)
        ),
        jsonb_build_array(
          jsonb_build_object('resource_id', v_res_grain::text, 'amount', 2)
        ),
        jsonb_build_array(
          jsonb_build_object('type', 'population_cap_increase', 'amount', 5)
        )
      ),
      (
        v_tier_smithy_1, v_bp_smithy, 1, 7,
        jsonb_build_array(
          jsonb_build_object('resource_id', v_res_iron_ore::text,    'amount', 4),
          jsonb_build_object('resource_id', v_res_stone_block::text, 'amount', 6)
        ),
        '[]'::jsonb,
        jsonb_build_array(
          jsonb_build_object('type', 'resource_storage_increase',
                             'resource_id', v_res_iron_ore::text, 'amount', 100),
          jsonb_build_object('type', 'job_capacity_increase',
                             'job_id', v_job_stone_mason::text, 'amount', 1)
        )
      ),
      (
        v_tier_smithy_2, v_bp_smithy, 2, 12,
        jsonb_build_array(
          jsonb_build_object('resource_id', v_res_iron_ore::text,      'amount',  8),
          jsonb_build_object('resource_id', v_res_stone_block::text,   'amount', 12),
          jsonb_build_object('resource_id', v_res_copper_ingot::text,  'amount',  4)
        ),
        '[]'::jsonb,
        jsonb_build_array(
          jsonb_build_object('type', 'resource_storage_increase',
                             'resource_id', v_res_iron_ore::text, 'amount', 250),
          jsonb_build_object('type', 'job_capacity_increase',
                             'job_id', v_job_stone_mason::text, 'amount', 2)
        )
      )
    on conflict (building_blueprint_id, tier_number) do update
    set
      worker_turns_required = excluded.worker_turns_required,
      construction_costs_json = excluded.construction_costs_json,
      upkeep_costs_json = excluded.upkeep_costs_json,
      effects_json = excluded.effects_json,
      updated_at = now();
  end loop;
end$$;

-- ===========================================================================
-- Epic 5 settlement operations: buildings, construction projects, deposits,
-- managed populations, trade routes, citizen assignments, and stockpiles.
-- All rows use ON CONFLICT ... DO UPDATE for idempotent re-seeding.
--
-- UUID scheme (fourth UUID group, Epic 5 prefix):
--   settlement_buildings         '00000000-0000-0000-000a-' || lpad(S*10+I, 12, '0')
--   construction_projects        '00000000-0000-0000-000b-' || lpad(S,      12, '0')
--   deposit_instances            '00000000-0000-0000-000c-' || lpad(S,      12, '0')
--   managed_population_instances '00000000-0000-0000-000d-' || lpad(S,      12, '0')
--   trade_routes                 '00000000-0000-0000-000e-' || lpad(W*100+R, 12, '0')
-- S = canonical settlement slot (1=301 Hearthwatch, 2=302 Mistfall Crossing,
--     3=303 Sunmere Hold, 4=304 Tidewatch, 5=305 Stonehold Keep), I = building
--     index within the settlement (1..3), W = 1-based world index, R = route
--     index within that world.
--
-- All Epic 4 IDs referenced below are derived from the scheme documented in
-- the Epic 4 DO block above (resources=0004, jobs=0005, blueprints=0006,
-- tiers=0007, deposit_types=0008, pop_types=0009, each using W=1 for world 101).
-- ===========================================================================
-- ---------------------------------------------------------------------------
-- Citizen 415: NPC at Stonehold Keep (settlement 305, Verdant Reach) for the
-- culling assignment. Must be inserted before citizen_assignments references it.
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
    npc_trait_1,
    npc_trait_2,
    npc_secret_contradiction,
    npc_goal,
    npc_flaw
  )
values
  (
    '00000000-0000-0000-0000-000000000415',
    '00000000-0000-0000-0000-000000000101',
    '00000000-0000-0000-0000-000000000305',
    'npc',
    'Davin Stonehill',
    'male',
    'alive',
    -35,
    'stoic',
    'blunt',
    'holds a vow they cannot remember swearing',
    'to outlive every captain they ever served',
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

-- ---------------------------------------------------------------------------
-- Settlement buildings: 3 completed buildings per canonical settlement in
-- Verdant Reach (W=1). The three blueprints cover the three settlement effect
-- types: job_capacity_increase (farmstead tier 1), resource_storage_increase
-- (storehouse tier 1), population_cap_increase (longhouse tier 1).
-- The check_settlement_building_tier_match trigger validates blueprint/tier
-- alignment at INSERT time.
-- ---------------------------------------------------------------------------
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
  -- Hearthwatch (301): farmstead=101, storehouse=102, longhouse=104
  (
    '00000000-0000-0000-000a-000000000011',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0006-000000000101',
    '00000000-0000-0000-0007-000000001011',
    'active',
    0
  ),
  (
    '00000000-0000-0000-000a-000000000012',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0006-000000000102',
    '00000000-0000-0000-0007-000000001021',
    'active',
    0
  ),
  (
    '00000000-0000-0000-000a-000000000013',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0006-000000000104',
    '00000000-0000-0000-0007-000000001041',
    'active',
    0
  ),
  -- Mistfall Crossing (302)
  (
    '00000000-0000-0000-000a-000000000021',
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0006-000000000101',
    '00000000-0000-0000-0007-000000001011',
    'active',
    0
  ),
  (
    '00000000-0000-0000-000a-000000000022',
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0006-000000000102',
    '00000000-0000-0000-0007-000000001021',
    'active',
    0
  ),
  (
    '00000000-0000-0000-000a-000000000023',
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0006-000000000104',
    '00000000-0000-0000-0007-000000001041',
    'active',
    0
  ),
  -- Sunmere Hold (303)
  (
    '00000000-0000-0000-000a-000000000031',
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0006-000000000101',
    '00000000-0000-0000-0007-000000001011',
    'active',
    0
  ),
  (
    '00000000-0000-0000-000a-000000000032',
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0006-000000000102',
    '00000000-0000-0000-0007-000000001021',
    'active',
    0
  ),
  (
    '00000000-0000-0000-000a-000000000033',
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0006-000000000104',
    '00000000-0000-0000-0007-000000001041',
    'active',
    0
  ),
  -- Tidewatch (304)
  (
    '00000000-0000-0000-000a-000000000041',
    '00000000-0000-0000-0000-000000000304',
    '00000000-0000-0000-0006-000000000101',
    '00000000-0000-0000-0007-000000001011',
    'active',
    0
  ),
  (
    '00000000-0000-0000-000a-000000000042',
    '00000000-0000-0000-0000-000000000304',
    '00000000-0000-0000-0006-000000000102',
    '00000000-0000-0000-0007-000000001021',
    'active',
    0
  ),
  (
    '00000000-0000-0000-000a-000000000043',
    '00000000-0000-0000-0000-000000000304',
    '00000000-0000-0000-0006-000000000104',
    '00000000-0000-0000-0007-000000001041',
    'active',
    0
  ),
  -- Stonehold Keep (305)
  (
    '00000000-0000-0000-000a-000000000051',
    '00000000-0000-0000-0000-000000000305',
    '00000000-0000-0000-0006-000000000101',
    '00000000-0000-0000-0007-000000001011',
    'active',
    0
  ),
  (
    '00000000-0000-0000-000a-000000000052',
    '00000000-0000-0000-0000-000000000305',
    '00000000-0000-0000-0006-000000000102',
    '00000000-0000-0000-0007-000000001021',
    'active',
    0
  ),
  (
    '00000000-0000-0000-000a-000000000053',
    '00000000-0000-0000-0000-000000000305',
    '00000000-0000-0000-0006-000000000104',
    '00000000-0000-0000-0007-000000001041',
    'active',
    0
  )
on conflict (id) do update
set
  settlement_id = excluded.settlement_id,
  building_blueprint_id = excluded.building_blueprint_id,
  current_tier_id = excluded.current_tier_id,
  state = excluded.state,
  activated_on_turn_number = excluded.activated_on_turn_number,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Construction projects: 1 in-progress smithy (tier 1) per canonical
-- settlement. Smithy tier 1 requires 7 worker_turns_required (Epic 4 seed);
-- progress_worker_turns=4 represents partial completion.
-- The partial unique index on (settlement_id, queue_position) WHERE status IN
-- ('queued','in_progress','paused') is satisfied because each settlement has
-- exactly one in-progress project at queue_position=1.
-- ---------------------------------------------------------------------------
insert into
  public.construction_projects (
    id,
    settlement_id,
    building_blueprint_id,
    target_tier_id,
    status,
    queue_position,
    progress_worker_turns
  )
values
  (
    '00000000-0000-0000-000b-000000000001',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0006-000000000105',
    '00000000-0000-0000-0007-000000001051',
    'in_progress',
    1,
    4
  ),
  (
    '00000000-0000-0000-000b-000000000002',
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0006-000000000105',
    '00000000-0000-0000-0007-000000001051',
    'in_progress',
    1,
    4
  ),
  (
    '00000000-0000-0000-000b-000000000003',
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0006-000000000105',
    '00000000-0000-0000-0007-000000001051',
    'in_progress',
    1,
    4
  ),
  (
    '00000000-0000-0000-000b-000000000004',
    '00000000-0000-0000-0000-000000000304',
    '00000000-0000-0000-0006-000000000105',
    '00000000-0000-0000-0007-000000001051',
    'in_progress',
    1,
    4
  ),
  (
    '00000000-0000-0000-000b-000000000005',
    '00000000-0000-0000-0000-000000000305',
    '00000000-0000-0000-0006-000000000105',
    '00000000-0000-0000-0007-000000001051',
    'in_progress',
    1,
    4
  )
on conflict (id) do update
set
  status = excluded.status,
  progress_worker_turns = excluded.progress_worker_turns,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Deposit instances: 1 per canonical settlement with varied deposit types so
-- the panel surfaces different resource configurations.
-- ---------------------------------------------------------------------------
insert into
  public.deposit_instances (
    id,
    settlement_id,
    deposit_type_id,
    name,
    status,
    max_workers
  )
values
  -- Hearthwatch (301): iron vein (dep_type offset 1)
  (
    '00000000-0000-0000-000c-000000000001',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0008-000000000101',
    'Eastwall Iron Vein',
    'active',
    8
  ),
  -- Mistfall Crossing (302): hardwood grove (dep_type offset 4)
  (
    '00000000-0000-0000-000c-000000000002',
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0008-000000000104',
    'Riverbank Hardwood Grove',
    'active',
    6
  ),
  -- Sunmere Hold (303): stone quarry (dep_type offset 3)
  (
    '00000000-0000-0000-000c-000000000003',
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0008-000000000103',
    'Hilltop Stone Quarry',
    'active',
    10
  ),
  -- Tidewatch (304): copper vein (dep_type offset 2)
  (
    '00000000-0000-0000-000c-000000000004',
    '00000000-0000-0000-0000-000000000304',
    '00000000-0000-0000-0008-000000000102',
    'Headland Copper Vein',
    'active',
    6
  ),
  -- Stonehold Keep (305): iron vein (dep_type offset 1)
  (
    '00000000-0000-0000-000c-000000000005',
    '00000000-0000-0000-0000-000000000305',
    '00000000-0000-0000-0008-000000000101',
    'Granite Seam Iron Vein',
    'active',
    8
  )
on conflict (id) do update
set
  name = excluded.name,
  status = excluded.status,
  max_workers = excluded.max_workers,
  updated_at = now();

-- Deposit instance resources: one resource per deposit instance.
-- ON CONFLICT targets the unique constraint (deposit_instance_id, resource_id).
-- Resource IDs use the W=1 formula: lpad(1*100+offset, 12, '0').
insert into
  public.deposit_instance_resources (
    deposit_instance_id,
    resource_id,
    initial_quantity,
    remaining_quantity
  )
values
  -- Hearthwatch iron vein → iron ore (resource offset 10)
  (
    '00000000-0000-0000-000c-000000000001',
    '00000000-0000-0000-0004-000000000110',
    5000,
    4800
  ),
  -- Mistfall hardwood grove → hardwood logs (resource offset 8)
  (
    '00000000-0000-0000-000c-000000000002',
    '00000000-0000-0000-0004-000000000108',
    3000,
    2750
  ),
  -- Sunmere stone quarry → stone block (resource offset 9)
  (
    '00000000-0000-0000-000c-000000000003',
    '00000000-0000-0000-0004-000000000109',
    8000,
    7600
  ),
  -- Tidewatch copper vein → copper ingot (resource offset 11)
  (
    '00000000-0000-0000-000c-000000000004',
    '00000000-0000-0000-0004-000000000111',
    2000,
    1900
  ),
  -- Stonehold iron vein → iron ore (resource offset 10)
  (
    '00000000-0000-0000-000c-000000000005',
    '00000000-0000-0000-0004-000000000110',
    4000,
    3800
  )
on conflict (deposit_instance_id, resource_id) do update
set
  remaining_quantity = excluded.remaining_quantity,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Managed population instances: 1 per canonical settlement.
-- Settlement 302 uses sheep_herd so citizen 402 (Halden) can be assigned
-- husbandry. Settlement 305 uses pig_herd with configured_cull_quantity > 0
-- so citizen 415 (Davin) can be assigned culling.
-- ---------------------------------------------------------------------------
insert into
  public.managed_population_instances (
    id,
    settlement_id,
    managed_population_type_id,
    name,
    current_count,
    configured_cull_quantity,
    status
  )
values
  -- Hearthwatch (301): sheep herd (pop_type offset 1)
  (
    '00000000-0000-0000-000d-000000000001',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0009-000000000101',
    'Hearthwatch Flock',
    80,
    0,
    'active'
  ),
  -- Mistfall Crossing (302): sheep herd (for husbandry assignment)
  (
    '00000000-0000-0000-000d-000000000002',
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0009-000000000101',
    'Mistfall Flock',
    100,
    0,
    'active'
  ),
  -- Sunmere Hold (303): bee colony (pop_type offset 2)
  (
    '00000000-0000-0000-000d-000000000003',
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0009-000000000102',
    'Sunmere Hives',
    60,
    0,
    'active'
  ),
  -- Tidewatch (304): pig herd (pop_type offset 3)
  (
    '00000000-0000-0000-000d-000000000004',
    '00000000-0000-0000-0000-000000000304',
    '00000000-0000-0000-0009-000000000103',
    'Tidewatch Drove',
    50,
    0,
    'active'
  ),
  -- Stonehold Keep (305): pig herd with cull quota (for culling assignment)
  (
    '00000000-0000-0000-000d-000000000005',
    '00000000-0000-0000-0000-000000000305',
    '00000000-0000-0000-0009-000000000103',
    'Stonehold Drove',
    120,
    15,
    'active'
  )
on conflict (id) do update
set
  name = excluded.name,
  current_count = excluded.current_count,
  configured_cull_quantity = excluded.configured_cull_quantity,
  status = excluded.status,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Settlement resource stockpiles: set non-zero quantities for the five
-- canonical settlements in Verdant Reach (world 101).
-- Non-system resources (grain=101, beer=105, hardwood_logs=108,
-- stone_block=109, iron_ore=110) use deterministic W=1 UUIDs from Epic 4.
-- ---------------------------------------------------------------------------
insert into
  public.settlement_resource_stockpiles (settlement_id, resource_id, quantity)
values
  -- Hearthwatch (301)
  (
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0004-000000000101',
    250
  ),
  (
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0004-000000000105',
    60
  ),
  (
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0004-000000000108',
    120
  ),
  (
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0004-000000000109',
    200
  ),
  (
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0004-000000000110',
    80
  ),
  -- Mistfall Crossing (302)
  (
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0004-000000000101',
    180
  ),
  (
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0004-000000000105',
    40
  ),
  (
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0004-000000000108',
    90
  ),
  (
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0004-000000000109',
    150
  ),
  (
    '00000000-0000-0000-0000-000000000302',
    '00000000-0000-0000-0004-000000000110',
    55
  ),
  -- Sunmere Hold (303)
  (
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0004-000000000101',
    300
  ),
  (
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0004-000000000105',
    75
  ),
  (
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0004-000000000108',
    160
  ),
  (
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0004-000000000109',
    240
  ),
  (
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0004-000000000110',
    100
  ),
  -- Tidewatch (304)
  (
    '00000000-0000-0000-0000-000000000304',
    '00000000-0000-0000-0004-000000000101',
    140
  ),
  (
    '00000000-0000-0000-0000-000000000304',
    '00000000-0000-0000-0004-000000000105',
    35
  ),
  (
    '00000000-0000-0000-0000-000000000304',
    '00000000-0000-0000-0004-000000000108',
    70
  ),
  (
    '00000000-0000-0000-0000-000000000304',
    '00000000-0000-0000-0004-000000000109',
    110
  ),
  (
    '00000000-0000-0000-0000-000000000304',
    '00000000-0000-0000-0004-000000000110',
    45
  ),
  -- Stonehold Keep (305)
  (
    '00000000-0000-0000-0000-000000000305',
    '00000000-0000-0000-0004-000000000101',
    200
  ),
  (
    '00000000-0000-0000-0000-000000000305',
    '00000000-0000-0000-0004-000000000105',
    50
  ),
  (
    '00000000-0000-0000-0000-000000000305',
    '00000000-0000-0000-0004-000000000108',
    100
  ),
  (
    '00000000-0000-0000-0000-000000000305',
    '00000000-0000-0000-0004-000000000109',
    180
  ),
  (
    '00000000-0000-0000-0000-000000000305',
    '00000000-0000-0000-0004-000000000110',
    65
  )
on conflict (settlement_id, resource_id) do update
set
  quantity = excluded.quantity,
  updated_at = now();

-- System resources (Food, Fresh Water): resolved by slug + world_id because
-- their UUIDs are generated non-deterministically by the
-- worlds_seed_system_resources trigger at world INSERT time.
insert into
  public.settlement_resource_stockpiles (settlement_id, resource_id, quantity)
select
  v.settlement_id,
  r.id,
  v.quantity
from
  (
    values
      (
        '00000000-0000-0000-0000-000000000301'::uuid,
        'food',
        120::numeric
      ),
      (
        '00000000-0000-0000-0000-000000000301'::uuid,
        'fresh-water',
        95::numeric
      ),
      (
        '00000000-0000-0000-0000-000000000302'::uuid,
        'food',
        90::numeric
      ),
      (
        '00000000-0000-0000-0000-000000000302'::uuid,
        'fresh-water',
        70::numeric
      ),
      (
        '00000000-0000-0000-0000-000000000303'::uuid,
        'food',
        150::numeric
      ),
      (
        '00000000-0000-0000-0000-000000000303'::uuid,
        'fresh-water',
        110::numeric
      ),
      (
        '00000000-0000-0000-0000-000000000304'::uuid,
        'food',
        80::numeric
      ),
      (
        '00000000-0000-0000-0000-000000000304'::uuid,
        'fresh-water',
        65::numeric
      ),
      (
        '00000000-0000-0000-0000-000000000305'::uuid,
        'food',
        100::numeric
      ),
      (
        '00000000-0000-0000-0000-000000000305'::uuid,
        'fresh-water',
        80::numeric
      )
  ) as v (settlement_id, slug, quantity)
  join public.resources r on r.world_id = '00000000-0000-0000-0000-000000000101'
  and r.slug = v.slug
  and r.is_system_resource = true
on conflict (settlement_id, resource_id) do update
set
  quantity = excluded.quantity,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Trade routes.
-- World 101: one active cross-nation route (Hearthwatch 301, Ashvale →
-- Tidewatch 304, Tideholm; grain) and one pending route (Sunmere Hold 303,
-- Ashvale → Stonehold Keep 305, Stoneridge; wool).
-- Worlds 102-105: one active cross-nation grain route each using the first
-- settlement of two different bulk nations.
--
-- Approvers are validated by the check_trade_route_approver_nation trigger:
-- each approver's settlement must belong to the matching endpoint's nation.
-- World 101 origin approver: Mara Quill (411, settlement 301, Ashvale).
-- World 101 destination approver: Pell Auren (414, settlement 304, Tideholm).
-- Bulk world approvers are the first NPC of each endpoint settlement (P=1).
-- ---------------------------------------------------------------------------
insert into
  public.trade_routes (
    id,
    origin_settlement_id,
    destination_settlement_id,
    resource_id,
    quantity_per_transition,
    status,
    proposed_by_citizen_id,
    origin_approval_status,
    destination_approval_status,
    origin_approved_by_citizen_id,
    destination_approved_by_citizen_id
  )
values
  -- World 101 active: Hearthwatch (301) → Tidewatch (304), grain.
  (
    '00000000-0000-0000-000e-000000000101',
    '00000000-0000-0000-0000-000000000301',
    '00000000-0000-0000-0000-000000000304',
    '00000000-0000-0000-0004-000000000101',
    25,
    'active',
    '00000000-0000-0000-0000-000000000401',
    'approved',
    'approved',
    '00000000-0000-0000-0000-000000000411',
    '00000000-0000-0000-0000-000000000414'
  ),
  -- World 101 pending: Sunmere Hold (303) → Stonehold Keep (305), wool.
  (
    '00000000-0000-0000-000e-000000000102',
    '00000000-0000-0000-0000-000000000303',
    '00000000-0000-0000-0000-000000000305',
    '00000000-0000-0000-0004-000000000107',
    15,
    'proposed',
    '00000000-0000-0000-0000-000000000403',
    'pending',
    'pending',
    null,
    null
  ),
  -- World 102 active: Riverdown Cantons S1 → Mosswold Reach S1, grain W=2.
  -- Nation N=2: lpad(202,12,'0'). Settlement: lpad(W*10000+N*100+S,12,'0').
  -- NPC: lpad(W*100000+N*1000+S*10+P,12,'0').
  (
    '00000000-0000-0000-000e-000000000201',
    '00000000-0000-0000-0002-000000020201',
    '00000000-0000-0000-0002-000000020301',
    '00000000-0000-0000-0004-000000000201',
    20,
    'active',
    '00000000-0000-0000-0003-000000202011',
    'approved',
    'approved',
    '00000000-0000-0000-0003-000000202011',
    '00000000-0000-0000-0003-000000203011'
  ),
  -- World 103 active: Verdant Pact S1 → Tidewatch Holdings S1, grain W=3.
  (
    '00000000-0000-0000-000e-000000000301',
    '00000000-0000-0000-0002-000000030201',
    '00000000-0000-0000-0002-000000030301',
    '00000000-0000-0000-0004-000000000301',
    20,
    'active',
    '00000000-0000-0000-0003-000000302011',
    'approved',
    'approved',
    '00000000-0000-0000-0003-000000302011',
    '00000000-0000-0000-0003-000000303011'
  ),
  -- World 104 active: Hollowmere Crown S1 → Salt Marsh Republic S1, grain W=4.
  (
    '00000000-0000-0000-000e-000000000401',
    '00000000-0000-0000-0002-000000040101',
    '00000000-0000-0000-0002-000000040201',
    '00000000-0000-0000-0004-000000000401',
    20,
    'active',
    '00000000-0000-0000-0003-000000401011',
    'approved',
    'approved',
    '00000000-0000-0000-0003-000000401011',
    '00000000-0000-0000-0003-000000402011'
  ),
  -- World 105 active: Stormhold Crown S1 → Ashfen Republic S1, grain W=5.
  (
    '00000000-0000-0000-000e-000000000501',
    '00000000-0000-0000-0002-000000050101',
    '00000000-0000-0000-0002-000000050201',
    '00000000-0000-0000-0004-000000000501',
    20,
    'active',
    '00000000-0000-0000-0003-000000501011',
    'approved',
    'approved',
    '00000000-0000-0000-0003-000000501011',
    '00000000-0000-0000-0003-000000502011'
  )
on conflict (id) do update
set
  status = excluded.status,
  origin_approval_status = excluded.origin_approval_status,
  destination_approval_status = excluded.destination_approval_status,
  origin_approved_by_citizen_id = excluded.origin_approved_by_citizen_id,
  destination_approved_by_citizen_id = excluded.destination_approved_by_citizen_id,
  updated_at = now();

-- ---------------------------------------------------------------------------
-- Citizen assignments: all 6 assignment_type values represented in world 101.
-- Three standard_job assignments (citizens 411, 412, 413), plus one each of
-- trade_route, construction_project, husbandry, deposit, and culling.
--
-- The citizen_assignments_check_trade_route_end trigger fires BEFORE INSERT
-- for trade_route rows and validates citizen.settlement_id against the route
-- endpoint. Aria (401) is at settlement 301 = origin_settlement_id of route
-- 000e-101, so trade_route_end='origin' passes. ✓
-- ---------------------------------------------------------------------------
insert into
  public.citizen_assignments (
    citizen_id,
    assignment_type,
    job_id,
    construction_project_id,
    deposit_instance_id,
    managed_population_instance_id,
    trade_route_id,
    trade_route_end,
    assigned_on_turn_number
  )
values
  -- Mara Quill (411, Hearthwatch 301): standard_job → grain farmer (job offset 1)
  (
    '00000000-0000-0000-0000-000000000411',
    'standard_job',
    '00000000-0000-0000-0005-000000000101',
    null,
    null,
    null,
    null,
    null,
    0
  ),
  -- Tessen Marrow (421, settlement 301): trade_route, origin end of route 101
  (
    '00000000-0000-0000-0000-000000000421',
    'trade_route',
    null,
    null,
    null,
    null,
    '00000000-0000-0000-000e-000000000101',
    'origin',
    0
  ),
  -- Pell Auren (414, Tidewatch 304): construction_project → smithy project at 304
  (
    '00000000-0000-0000-0000-000000000414',
    'construction_project',
    null,
    '00000000-0000-0000-000b-000000000004',
    null,
    null,
    null,
    null,
    0
  ),
  -- Joren Bask (412, Mistfall 302): husbandry → sheep flock at 302
  (
    '00000000-0000-0000-0000-000000000412',
    'husbandry',
    null,
    null,
    null,
    '00000000-0000-0000-000d-000000000002',
    null,
    null,
    0
  ),
  -- Sable Wren (413, Sunmere 303): deposit → stone quarry at 303
  (
    '00000000-0000-0000-0000-000000000413',
    'deposit',
    null,
    null,
    '00000000-0000-0000-000c-000000000003',
    null,
    null,
    null,
    0
  ),
  -- Davin Stonehill (415, Stonehold 305): culling → pig drove at 305
  (
    '00000000-0000-0000-0000-000000000415',
    'culling',
    null,
    null,
    null,
    '00000000-0000-0000-000d-000000000005',
    null,
    null,
    0
  )
on conflict (citizen_id) do update
set
  assignment_type = excluded.assignment_type,
  job_id = excluded.job_id,
  construction_project_id = excluded.construction_project_id,
  deposit_instance_id = excluded.deposit_instance_id,
  managed_population_instance_id = excluded.managed_population_instance_id,
  trade_route_id = excluded.trade_route_id,
  trade_route_end = excluded.trade_route_end,
  assigned_on_turn_number = excluded.assigned_on_turn_number,
  updated_at = now();
