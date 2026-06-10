-- pgTAP tests for namesets RPC error contract and RLS policies.
-- Covers: P0002 (not found / null params), 42501 (unauthorized), and
-- RLS INSERT/UPDATE/DELETE restrictions.
-- Run with: npx supabase test db
begin;

select
  plan (16);

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
    'f0000000-0000-0000-0000-000000000001',
    'namesets-admin@example.com',
    'x',
    now(),
    '{"username":"namesets_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'f0000000-0000-0000-0000-000000000002',
    'namesets-outsider@example.com',
    'x',
    now(),
    '{"username":"namesets_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, owner_id, name, visibility, status)
values
  (
    'f1000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000001',
    'Namesets Test World A',
    'private',
    'active'
  ),
  (
    'f1000000-0000-0000-0000-000000000002',
    'f0000000-0000-0000-0000-000000000001',
    'Namesets Test World B',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'f1000000-0000-0000-0000-000000000001',
    'f0000000-0000-0000-0000-000000000001'
  );

insert into
  public.namesets (id, world_id, name, config_json, is_default)
values
  (
    'f2000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000001',
    'World A Nameset 1',
    public.default_naming_config (),
    false
  ),
  (
    'f2000000-0000-0000-0000-000000000002',
    'f1000000-0000-0000-0000-000000000001',
    'World A Nameset 2',
    public.default_naming_config (),
    false
  ),
  (
    'f2000000-0000-0000-0000-000000000003',
    'f1000000-0000-0000-0000-000000000002',
    'World B Nameset 1',
    public.default_naming_config (),
    false
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'f3000000-0000-0000-0000-000000000001',
    'f1000000-0000-0000-0000-000000000001',
    'Test Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'f4000000-0000-0000-0000-000000000001',
    'f3000000-0000-0000-0000-000000000001',
    'Test Settlement'
  );

-- ===========================================================================
-- P0002 (no_data_found) — admin calls with a non-existent nameset ID.
-- Auth check fires first (passes for admin), then row-exists check
-- raises P0002.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
      select public.soft_delete_nameset (
        '00000000-0000-0000-0000-000000000000',
        'f1000000-0000-0000-0000-000000000001'
      )
    $test$,
    'P0002',
    null,
    'soft_delete_nameset raises P0002 for non-existent nameset'
  );

select
  throws_ok (
    $test$
      select public.restore_nameset (
        '00000000-0000-0000-0000-000000000000',
        'f1000000-0000-0000-0000-000000000001'
      )
    $test$,
    'P0002',
    null,
    'restore_nameset raises P0002 for non-existent nameset'
  );

select
  throws_ok (
    $test$
      select public.hard_delete_nameset (
        '00000000-0000-0000-0000-000000000000',
        'f1000000-0000-0000-0000-000000000001'
      )
    $test$,
    'P0002',
    null,
    'hard_delete_nameset raises P0002 for non-existent nameset'
  );

select
  throws_ok (
    $test$
      select public.set_world_default_nameset (
        '00000000-0000-0000-0000-000000000000',
        'f1000000-0000-0000-0000-000000000001'
      )
    $test$,
    'P0002',
    null,
    'set_world_default_nameset raises P0002 for non-existent nameset'
  );

select
  throws_ok (
    $test$
      select public.set_nation_nameset (
        'f3000000-0000-0000-0000-000000000001',
        'f1000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000000'
      )
    $test$,
    'P0002',
    null,
    'set_nation_nameset raises P0002 for non-existent nameset'
  );

select
  throws_ok (
    $test$
      select public.set_settlement_nameset (
        'f4000000-0000-0000-0000-000000000001',
        'f1000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-000000000000'
      )
    $test$,
    'P0002',
    null,
    'set_settlement_nameset raises P0002 for non-existent nameset'
  );

reset role;

-- ===========================================================================
-- 42501 (insufficient_privilege) — non-admin calls with existing nameset IDs.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
      select public.soft_delete_nameset (
        'f2000000-0000-0000-0000-000000000001',
        'f1000000-0000-0000-0000-000000000001'
      )
    $test$,
    '42501',
    null,
    'soft_delete_nameset raises 42501 for unauthorized caller'
  );

select
  throws_ok (
    $test$
      select public.restore_nameset (
        'f2000000-0000-0000-0000-000000000001',
        'f1000000-0000-0000-0000-000000000001'
      )
    $test$,
    '42501',
    null,
    'restore_nameset raises 42501 for unauthorized caller'
  );

select
  throws_ok (
    $test$
      select public.hard_delete_nameset (
        'f2000000-0000-0000-0000-000000000001',
        'f1000000-0000-0000-0000-000000000001'
      )
    $test$,
    '42501',
    null,
    'hard_delete_nameset raises 42501 for unauthorized caller'
  );

select
  throws_ok (
    $test$
      select public.set_world_default_nameset (
        'f2000000-0000-0000-0000-000000000001',
        'f1000000-0000-0000-0000-000000000001'
      )
    $test$,
    '42501',
    null,
    'set_world_default_nameset raises 42501 for unauthorized caller'
  );

select
  throws_ok (
    $test$
      select public.set_nation_nameset (
        'f3000000-0000-0000-0000-000000000001',
        'f1000000-0000-0000-0000-000000000001',
        'f2000000-0000-0000-0000-000000000001'
      )
    $test$,
    '42501',
    null,
    'set_nation_nameset raises 42501 for unauthorized caller'
  );

select
  throws_ok (
    $test$
      select public.set_settlement_nameset (
        'f4000000-0000-0000-0000-000000000001',
        'f1000000-0000-0000-0000-000000000001',
        'f2000000-0000-0000-0000-000000000001'
      )
    $test$,
    '42501',
    null,
    'set_settlement_nameset raises 42501 for unauthorized caller'
  );

reset role;

-- ===========================================================================
-- RLS policies — non-admin users cannot directly insert/update/delete.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f0000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
      insert into public.namesets (world_id, name, config_json)
      values ('f1000000-0000-0000-0000-000000000001', 'Test Nameset', public.default_naming_config ())
    $test$,
    null,
    null,
    'non-admin user cannot insert into namesets via column grant'
  );

reset role;

-- ===========================================================================
-- Cross-world validation — set_*_nameset RPCs reject cross-world namesets.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f0000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
      select public.set_world_default_nameset (
        'f2000000-0000-0000-0000-000000000003',
        'f1000000-0000-0000-0000-000000000001'
      )
    $test$,
    'P0002',
    null,
    'set_world_default_nameset raises P0002 for cross-world nameset'
  );

select
  throws_ok (
    $test$
      select public.set_nation_nameset (
        'f3000000-0000-0000-0000-000000000001',
        'f1000000-0000-0000-0000-000000000001',
        'f2000000-0000-0000-0000-000000000003'
      )
    $test$,
    'P0002',
    null,
    'set_nation_nameset raises P0002 for cross-world nameset'
  );

select
  throws_ok (
    $test$
      select public.set_settlement_nameset (
        'f4000000-0000-0000-0000-000000000001',
        'f1000000-0000-0000-0000-000000000001',
        'f2000000-0000-0000-0000-000000000003'
      )
    $test$,
    'P0002',
    null,
    'set_settlement_nameset raises P0002 for cross-world nameset'
  );

reset role;

select
  *
from
  finish ();

rollback;
