-- pgTAP tests for restrict_child_domain_writes migration.
-- Run with: npx supabase test db
--
-- Covers:
--   • World owner/admin cannot mutate scope or system-owned columns on
--     public.nations through direct table updates (world_id, created_at,
--     updated_at).
--   • World owner/admin cannot mutate scope, system timestamp, readiness, or
--     placeholder identity columns on public.settlements through direct table
--     updates (nation_id, created_at, updated_at, is_ready_current_turn,
--     ready_set_at, last_ready_at, auto_ready_enabled,
--     ready_set_by_citizen_id).
--   • Allowed user-editable columns still work (nations.name/description/
--     is_hidden, settlements.name/description/coord_x/coord_z).
--   • Pre-seeding readiness/identity columns on INSERT is rejected.
--   • set_settlement_readiness and set_settlement_auto_ready do mutate the
--     intended fields when called by an admin, and are no-ops for callers
--     without admin access or against archived worlds.
begin;

select
  plan (21);

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
    '80000000-0000-0000-0000-000000000001',
    'child-domain-owner@example.com',
    'x',
    now(),
    '{"username":"child_domain_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    '80000000-0000-0000-0000-000000000002',
    'child-domain-other@example.com',
    'x',
    now(),
    '{"username":"child_domain_other"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, owner_id, visibility, status)
values
  (
    '81000000-0000-0000-0000-000000000001',
    'Child Domain World',
    '80000000-0000-0000-0000-000000000001',
    'private',
    'active'
  ),
  (
    '81000000-0000-0000-0000-000000000002',
    'Child Domain Other World',
    '80000000-0000-0000-0000-000000000001',
    'private',
    'active'
  );

insert into
  public.worlds (
    id,
    name,
    owner_id,
    visibility,
    status,
    archived_at
  )
values
  (
    '81000000-0000-0000-0000-000000000003',
    'Child Domain Archived World',
    '80000000-0000-0000-0000-000000000001',
    'private',
    'archived',
    now()
  );

insert into
  public.nations (id, world_id, name)
values
  (
    '82000000-0000-0000-0000-000000000001',
    '81000000-0000-0000-0000-000000000001',
    'Child Domain Nation'
  ),
  (
    '82000000-0000-0000-0000-000000000002',
    '81000000-0000-0000-0000-000000000002',
    'Child Domain Other Nation'
  ),
  (
    '82000000-0000-0000-0000-000000000003',
    '81000000-0000-0000-0000-000000000003',
    'Child Domain Archived Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    '83000000-0000-0000-0000-000000000001',
    '82000000-0000-0000-0000-000000000001',
    'Child Domain Settlement'
  ),
  (
    '83000000-0000-0000-0000-000000000003',
    '82000000-0000-0000-0000-000000000003',
    'Child Domain Archived Settlement'
  );

-- ===========================================================================
-- OWNER: scope and system columns are rejected by column-level privileges
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"80000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    update public.nations
    set world_id = '81000000-0000-0000-0000-000000000002'
    where id = '82000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    null,
    'admin cannot relocate a nation between worlds via table update'
  );

select
  throws_ok (
    $test$
    update public.nations
    set created_at = now() - interval '1 day'
    where id = '82000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    null,
    'admin cannot rewrite nations.created_at directly'
  );

select
  throws_ok (
    $test$
    update public.nations
    set updated_at = now() - interval '1 day'
    where id = '82000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    null,
    'admin cannot rewrite nations.updated_at directly'
  );

select
  throws_ok (
    $test$
    update public.settlements
    set nation_id = '82000000-0000-0000-0000-000000000002'
    where id = '83000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    null,
    'admin cannot relocate a settlement between nations via table update'
  );

select
  throws_ok (
    $test$
    update public.settlements
    set created_at = now() - interval '1 day'
    where id = '83000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    null,
    'admin cannot rewrite settlements.created_at directly'
  );

select
  throws_ok (
    $test$
    update public.settlements
    set updated_at = now() - interval '1 day'
    where id = '83000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    null,
    'admin cannot rewrite settlements.updated_at directly'
  );

select
  throws_ok (
    $test$
    update public.settlements
    set is_ready_current_turn = true
    where id = '83000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    null,
    'admin cannot set is_ready_current_turn directly'
  );

select
  throws_ok (
    $test$
    update public.settlements
    set ready_set_at = now()
    where id = '83000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    null,
    'admin cannot set ready_set_at directly'
  );

select
  throws_ok (
    $test$
    update public.settlements
    set last_ready_at = now()
    where id = '83000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    null,
    'admin cannot set last_ready_at directly'
  );

select
  throws_ok (
    $test$
    update public.settlements
    set auto_ready_enabled = true
    where id = '83000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    null,
    'admin cannot set auto_ready_enabled directly'
  );

select
  throws_ok (
    $test$
    update public.settlements
    set ready_set_by_citizen_id = '90000000-0000-0000-0000-000000000001'
    where id = '83000000-0000-0000-0000-000000000001'
  $test$,
    '42501',
    null,
    'admin cannot set ready_set_by_citizen_id directly'
  );

select
  throws_ok (
    $test$
    insert into public.settlements (
      id, nation_id, name, is_ready_current_turn
    )
    values (
      '83000000-0000-0000-0000-000000000002',
      '82000000-0000-0000-0000-000000000001',
      'Pre-Ready Settlement',
      true
    )
  $test$,
    '42501',
    null,
    'admin cannot pre-seed is_ready_current_turn on insert'
  );

select
  throws_ok (
    $test$
    insert into public.settlements (
      id, nation_id, name, ready_set_by_citizen_id
    )
    values (
      '83000000-0000-0000-0000-000000000002',
      '82000000-0000-0000-0000-000000000001',
      'Pre-Ready Identity Settlement',
      '90000000-0000-0000-0000-000000000001'
    )
  $test$,
    '42501',
    null,
    'admin cannot pre-seed ready_set_by_citizen_id on insert'
  );

-- ===========================================================================
-- OWNER: allowed user-editable columns still work
-- ===========================================================================
select
  lives_ok (
    $test$
    update public.nations
    set name = 'Renamed Nation', description = 'New description', is_hidden = true
    where id = '82000000-0000-0000-0000-000000000001'
  $test$,
    'admin can update nations.name/description/is_hidden'
  );

select
  lives_ok (
    $test$
    update public.settlements
    set name = 'Renamed Settlement',
        description = 'New description',
        coord_x = 1.25,
        coord_z = -3.5
    where id = '83000000-0000-0000-0000-000000000001'
  $test$,
    'admin can update settlements.name/description/coord_x/coord_z'
  );

-- ===========================================================================
-- RPC: set_settlement_readiness writes readiness fields when caller is admin
-- ===========================================================================
select
  ok (
    (
      select
        is_ready_current_turn
      from
        public.set_settlement_readiness ('83000000-0000-0000-0000-000000000001', true)
    ),
    'set_settlement_readiness marks settlement ready for admin caller'
  );

select
  ok (
    (
      select
        ready_set_at is not null
        and last_ready_at is not null
      from
        public.settlements
      where
        id = '83000000-0000-0000-0000-000000000001'
    ),
    'set_settlement_readiness populates ready_set_at and last_ready_at'
  );

select
  ok (
    (
      select
        auto_ready_enabled
      from
        public.set_settlement_auto_ready ('83000000-0000-0000-0000-000000000001', true)
    ),
    'set_settlement_auto_ready enables auto-ready for admin caller'
  );

-- Archived worlds raise P0001 via the RPC.
select
  throws_ok (
    $test$
    select public.set_settlement_readiness ('83000000-0000-0000-0000-000000000003', true)
    $test$,
    'P0001',
    null,
    'set_settlement_readiness raises P0001 for archived-world settlement'
  );

reset role;

-- ===========================================================================
-- NON-ADMIN: RPC raises 42501 for callers without admin access.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"80000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_settlement_readiness ('83000000-0000-0000-0000-000000000001', false)
    $test$,
    '42501',
    null,
    'set_settlement_readiness raises 42501 for non-admin caller'
  );

select
  throws_ok (
    $test$
    select public.set_settlement_auto_ready ('83000000-0000-0000-0000-000000000001', false)
    $test$,
    '42501',
    null,
    'set_settlement_auto_ready raises 42501 for non-admin caller'
  );

reset role;

select
  *
from
  finish ();

rollback;
