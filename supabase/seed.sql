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
  ready_set_at = excluded.ready_set_at,
  ready_set_by_citizen_id = excluded.ready_set_by_citizen_id,
  updated_at = now();
