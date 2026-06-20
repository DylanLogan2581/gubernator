-- Gubernator local development seed data.
--
-- This file is applied automatically by `supabase db reset`.
-- Keep seed data deterministic and safe to re-run.
-- These credentials are for local development only; never reuse them in hosted
-- Supabase projects or production data.
-- pgTAP is a test-only dependency required by `supabase test db`. It is created
-- here (local seed) rather than in a migration so it never ships to production.
create extension if not exists pgtap;

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
    '{"username":"aldermoor_warden"}'::jsonb,
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
    '{"username":"aldercross_steward"}'::jsonb,
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
    '{"username":"brammel_reeve"}'::jsonb,
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
  username = 'aldermoor_warden',
  status = 'active',
  is_super_admin = true
where
  id = '00000000-0000-0000-0000-000000000001';

update public.users
set
  username = 'aldercross_steward',
  status = 'active',
  is_super_admin = false
where
  id = '00000000-0000-0000-0000-000000000002';

update public.users
set
  username = 'brammel_reeve',
  status = 'active',
  is_super_admin = false
where
  id = '00000000-0000-0000-0000-000000000003';
