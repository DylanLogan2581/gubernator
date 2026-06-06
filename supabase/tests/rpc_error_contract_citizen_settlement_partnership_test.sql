-- pgTAP tests for the explicit error contract introduced in
-- 20260607000003_rpc_error_contract_citizen_settlement_partnership.
--
-- Covers 42501 (forbidden), P0002 (not found / null params), and P0001
-- (domain violation) for every converted RPC:
--   link_user_to_citizen, unlink_user_from_citizen,
--   assign_citizen_role, revoke_citizen_role,
--   set_settlement_readiness, set_settlement_auto_ready,
--   create_partnership, dissolve_partnership,
--   mark_partnership_widowed, reassign_partner
begin;

select
  plan (30);

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
    'ec573000-0000-0000-0000-000000000001',
    'ec573-owner@example.com',
    'x',
    now(),
    '{"username":"ec573_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    'ec573000-0000-0000-0000-000000000002',
    'ec573-outsider@example.com',
    'x',
    now(),
    '{"username":"ec573_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    'ec573000-0000-0000-0000-000000000003',
    'ec573-link-target@example.com',
    'x',
    now(),
    '{"username":"ec573_link_target"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'ec573100-0000-0000-0000-000000000001',
    'EC573 Active World',
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'ec573100-0000-0000-0000-000000000001',
    'ec573000-0000-0000-0000-000000000001'
  );

insert into
  public.worlds (id, name, visibility, status, archived_at)
values
  (
    'ec573100-0000-0000-0000-000000000002',
    'EC573 Archived World',
    'private',
    'archived',
    now()
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'ec573100-0000-0000-0000-000000000002',
    'ec573000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'ec573200-0000-0000-0000-000000000001',
    'ec573100-0000-0000-0000-000000000001',
    'EC573 Nation'
  ),
  (
    'ec573200-0000-0000-0000-000000000002',
    'ec573100-0000-0000-0000-000000000002',
    'EC573 Archived Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'ec573300-0000-0000-0000-000000000001',
    'ec573200-0000-0000-0000-000000000001',
    'EC573 Settlement'
  ),
  (
    'ec573300-0000-0000-0000-000000000002',
    'ec573200-0000-0000-0000-000000000002',
    'EC573 Archived Settlement'
  );

-- NPC in active world (used for link/unlink/assign/revoke tests).
-- name is a generated column (given_name || coalesce(' ' || surname, '')).
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status
  )
values
  (
    'ec573400-0000-0000-0000-000000000001',
    'ec573100-0000-0000-0000-000000000001',
    'ec573300-0000-0000-0000-000000000001',
    'npc',
    'EC573 NPC',
    'alive'
  );

-- Player character in active world (used for assign/revoke tests).
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    user_id
  )
values
  (
    'ec573400-0000-0000-0000-000000000002',
    'ec573100-0000-0000-0000-000000000001',
    'ec573300-0000-0000-0000-000000000001',
    'player_character',
    'EC573 PC',
    'alive',
    'ec573000-0000-0000-0000-000000000002'
  );

-- Player character in archived world (domain-failure checks).
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    user_id
  )
values
  (
    'ec573400-0000-0000-0000-000000000003',
    'ec573100-0000-0000-0000-000000000002',
    'ec573300-0000-0000-0000-000000000002',
    'player_character',
    'EC573 Archived PC',
    'alive',
    'ec573000-0000-0000-0000-000000000003'
  );

-- Two NPCs for partnership tests.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status
  )
values
  (
    'ec573400-0000-0000-0000-000000000010',
    'ec573100-0000-0000-0000-000000000001',
    'ec573300-0000-0000-0000-000000000001',
    'npc',
    'EC573 Partner A',
    'alive'
  ),
  (
    'ec573400-0000-0000-0000-000000000011',
    'ec573100-0000-0000-0000-000000000001',
    'ec573300-0000-0000-0000-000000000001',
    'npc',
    'EC573 Partner B',
    'alive'
  ),
  (
    'ec573400-0000-0000-0000-000000000012',
    'ec573100-0000-0000-0000-000000000001',
    'ec573300-0000-0000-0000-000000000001',
    'npc',
    'EC573 Partner C',
    'alive'
  );

-- Turn transition for partnership audit rows.
insert into
  public.turn_transitions (
    id,
    world_id,
    from_turn_number,
    to_turn_number,
    initiated_by_user_id,
    status,
    finished_at
  )
values
  (
    'ec573500-0000-0000-0000-000000000001',
    'ec573100-0000-0000-0000-000000000001',
    0,
    1,
    'ec573000-0000-0000-0000-000000000001',
    'completed',
    now()
  );

-- Active partnership for dissolve / widowed / reassign tests.
insert into
  public.partnerships (
    id,
    citizen_a_id,
    citizen_b_id,
    status,
    formed_on_turn_number
  )
values
  (
    'ec573600-0000-0000-0000-000000000001',
    'ec573400-0000-0000-0000-000000000010',
    'ec573400-0000-0000-0000-000000000011',
    'active',
    1
  );

-- Dissolved partnership (used for mark_partnership_widowed P0001 test).
insert into
  public.partnerships (
    id,
    citizen_a_id,
    citizen_b_id,
    status,
    formed_on_turn_number,
    ended_on_turn_number
  )
values
  (
    'ec573600-0000-0000-0000-000000000002',
    'ec573400-0000-0000-0000-000000000012',
    'ec573400-0000-0000-0000-000000000010',
    'dissolved',
    1,
    2
  );

-- ===========================================================================
-- link_user_to_citizen
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.link_user_to_citizen (null, 'ec573000-0000-0000-0000-000000000003')
    $test$,
    'P0002',
    null,
    'link_user_to_citizen raises P0002 for null citizen_id'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.link_user_to_citizen (
      'ec573400-0000-0000-0000-000000000001',
      'ec573000-0000-0000-0000-000000000003'
    )
    $test$,
    '42501',
    null,
    'link_user_to_citizen raises 42501 for unauthorized caller'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.link_user_to_citizen (
      'ec573400-0000-0000-0000-000000000003',
      'ec573000-0000-0000-0000-000000000003'
    )
    $test$,
    'P0001',
    null,
    'link_user_to_citizen raises P0001 for archived world'
  );

reset role;

-- ===========================================================================
-- unlink_user_from_citizen
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.unlink_user_from_citizen (null)
    $test$,
    'P0002',
    null,
    'unlink_user_from_citizen raises P0002 for null citizen_id'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.unlink_user_from_citizen ('ec573400-0000-0000-0000-000000000002')
    $test$,
    '42501',
    null,
    'unlink_user_from_citizen raises 42501 for unauthorized caller'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.unlink_user_from_citizen ('ec573400-0000-0000-0000-000000000003')
    $test$,
    'P0001',
    null,
    'unlink_user_from_citizen raises P0001 for archived world'
  );

reset role;

-- ===========================================================================
-- assign_citizen_role
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.assign_citizen_role (null, 'settlement_manager', null, null)
    $test$,
    'P0002',
    null,
    'assign_citizen_role raises P0002 for null citizen_id'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.assign_citizen_role (
      'ec573400-0000-0000-0000-000000000002',
      'settlement_manager',
      null,
      'ec573300-0000-0000-0000-000000000001'
    )
    $test$,
    '42501',
    null,
    'assign_citizen_role raises 42501 for unauthorized caller'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.assign_citizen_role (
      'ec573400-0000-0000-0000-000000000002',
      'settlement_manager',
      null,
      '00000000-0000-0000-0000-000000000000'
    )
    $test$,
    'P0001',
    null,
    'assign_citizen_role raises P0001 for scope mismatch'
  );

reset role;

-- ===========================================================================
-- revoke_citizen_role
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.revoke_citizen_role (null)
    $test$,
    'P0002',
    null,
    'revoke_citizen_role raises P0002 for null citizen_id'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.revoke_citizen_role ('ec573400-0000-0000-0000-000000000002')
    $test$,
    '42501',
    null,
    'revoke_citizen_role raises 42501 for unauthorized caller'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.revoke_citizen_role ('ec573400-0000-0000-0000-000000000003')
    $test$,
    'P0001',
    null,
    'revoke_citizen_role raises P0001 for archived world'
  );

reset role;

-- ===========================================================================
-- set_settlement_readiness
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_settlement_readiness (null, true)
    $test$,
    'P0002',
    null,
    'set_settlement_readiness raises P0002 for null settlement_id'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_settlement_readiness ('ec573300-0000-0000-0000-000000000001', true)
    $test$,
    '42501',
    null,
    'set_settlement_readiness raises 42501 for unauthorized caller'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_settlement_readiness ('ec573300-0000-0000-0000-000000000002', true)
    $test$,
    'P0001',
    null,
    'set_settlement_readiness raises P0001 for archived world'
  );

reset role;

-- ===========================================================================
-- set_settlement_auto_ready
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_settlement_auto_ready (null, true)
    $test$,
    'P0002',
    null,
    'set_settlement_auto_ready raises P0002 for null settlement_id'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_settlement_auto_ready ('ec573300-0000-0000-0000-000000000001', true)
    $test$,
    '42501',
    null,
    'set_settlement_auto_ready raises 42501 for unauthorized caller'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.set_settlement_auto_ready ('ec573300-0000-0000-0000-000000000002', true)
    $test$,
    'P0001',
    null,
    'set_settlement_auto_ready raises P0001 for archived world'
  );

reset role;

-- ===========================================================================
-- create_partnership
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.create_partnership (
      null,
      'ec573400-0000-0000-0000-000000000011',
      1,
      'test reason',
      'ec573500-0000-0000-0000-000000000001'
    )
    $test$,
    'P0002',
    null,
    'create_partnership raises P0002 for null citizen_a_id'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.create_partnership (
      'ec573400-0000-0000-0000-000000000010',
      'ec573400-0000-0000-0000-000000000012',
      1,
      'outsider create',
      'ec573500-0000-0000-0000-000000000001'
    )
    $test$,
    '42501',
    null,
    'create_partnership raises 42501 for unauthorized caller'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.create_partnership (
      'ec573400-0000-0000-0000-000000000010',
      'ec573400-0000-0000-0000-000000000010',
      1,
      'self pair',
      'ec573500-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'create_partnership raises P0001 for same citizen on both sides'
  );

reset role;

-- ===========================================================================
-- dissolve_partnership
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.dissolve_partnership (
      null,
      1,
      'test reason',
      'ec573500-0000-0000-0000-000000000001'
    )
    $test$,
    'P0002',
    null,
    'dissolve_partnership raises P0002 for null partnership_id'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.dissolve_partnership (
      'ec573600-0000-0000-0000-000000000001',
      1,
      'outsider dissolve',
      'ec573500-0000-0000-0000-000000000001'
    )
    $test$,
    '42501',
    null,
    'dissolve_partnership raises 42501 for unauthorized caller'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.dissolve_partnership (
      'ec573600-0000-0000-0000-000000000001',
      0,
      'end before formed',
      'ec573500-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'dissolve_partnership raises P0001 when ended_on_turn_number precedes formed_on_turn_number'
  );

reset role;

-- ===========================================================================
-- mark_partnership_widowed
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.mark_partnership_widowed (
      null,
      1,
      'test reason',
      'ec573500-0000-0000-0000-000000000001'
    )
    $test$,
    'P0002',
    null,
    'mark_partnership_widowed raises P0002 for null partnership_id'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.mark_partnership_widowed (
      'ec573600-0000-0000-0000-000000000001',
      1,
      'outsider widen',
      'ec573500-0000-0000-0000-000000000001'
    )
    $test$,
    '42501',
    null,
    'mark_partnership_widowed raises 42501 for unauthorized caller'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.mark_partnership_widowed (
      'ec573600-0000-0000-0000-000000000002',
      2,
      'already dissolved',
      'ec573500-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'mark_partnership_widowed raises P0001 for non-active partnership'
  );

reset role;

-- ===========================================================================
-- reassign_partner
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.reassign_partner (
      null,
      'ec573400-0000-0000-0000-000000000010',
      'ec573400-0000-0000-0000-000000000012',
      1,
      2,
      'test reason',
      'ec573500-0000-0000-0000-000000000001'
    )
    $test$,
    'P0002',
    null,
    'reassign_partner raises P0002 for null old_partnership_id'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.reassign_partner (
      'ec573600-0000-0000-0000-000000000001',
      'ec573400-0000-0000-0000-000000000010',
      'ec573400-0000-0000-0000-000000000012',
      1,
      2,
      'outsider reassign',
      'ec573500-0000-0000-0000-000000000001'
    )
    $test$,
    '42501',
    null,
    'reassign_partner raises 42501 for unauthorized caller'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ec573000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.reassign_partner (
      'ec573600-0000-0000-0000-000000000001',
      'ec573400-0000-0000-0000-000000000010',
      'ec573400-0000-0000-0000-000000000012',
      0,
      2,
      'end before formed',
      'ec573500-0000-0000-0000-000000000001'
    )
    $test$,
    'P0001',
    null,
    'reassign_partner raises P0001 when ended_on_turn_number precedes old partnership formed_on_turn_number'
  );

reset role;

select
  *
from
  finish ();

rollback;
