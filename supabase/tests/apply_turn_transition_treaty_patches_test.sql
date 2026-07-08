-- pgTAP tests for the treaty-effects apply_turn_transition extension (#1090):
-- internal_apply_turn_transition_treaty_patches (expiry status flip) and the
-- nation.tribute_missed / nation.treaty_expired notification blocks added to
-- internal_apply_turn_transition_log_entries_and_notifications. Both
-- notification types must reach members of BOTH treaty nations.
-- Run with: npx supabase test db
--
-- UUID prefix map (all cb-prefixed ranges, unique to this file):
--   cb100000 = users        cb200000 = worlds
--   cb300000 = transitions  cb400000 = nations
--   cb500000 = settlements  cb600000 = resources
--   cb700000 = citizens     cb800000 = nation_treaties
begin;

select
  plan (7);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
-- Users: world admin (recipient for every notification) + one nation
-- manager per nation. Seeded super admin (from seed.sql) also contributes.
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
    'cb100000-0000-0000-0000-000000000001',
    'cbtp-world-admin@example.com',
    'x',
    now(),
    '{"username":"cbtp_world_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'cb100000-0000-0000-0000-000000000002',
    'cbtp-nation-mgr-1@example.com',
    'x',
    now(),
    '{"username":"cbtp_nation_mgr_1"}'::jsonb,
    now(),
    now()
  ),
  (
    'cb100000-0000-0000-0000-000000000003',
    'cbtp-nation-mgr-2@example.com',
    'x',
    now(),
    '{"username":"cbtp_nation_mgr_2"}'::jsonb,
    now(),
    now()
  );

-- World 1 (turn 5): happy path — expiry + both notification types.
-- World 2 (turn 5): cross-world guard.
insert into
  public.worlds (id, name, current_turn_number, visibility, status)
values
  (
    'cb200000-0000-0000-0000-000000000001',
    'CBTP World 1',
    5,
    'private',
    'active'
  ),
  (
    'cb200000-0000-0000-0000-000000000002',
    'CBTP World 2 (cross-world guard)',
    5,
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'cb200000-0000-0000-0000-000000000001',
    'cb100000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'cb400000-0000-0000-0000-000000000001',
    'cb200000-0000-0000-0000-000000000001',
    'CBTP Nation 1 (proposer/payer)'
  ),
  (
    'cb400000-0000-0000-0000-000000000002',
    'cb200000-0000-0000-0000-000000000001',
    'CBTP Nation 2 (responder/payee)'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'cb500000-0000-0000-0000-000000000001',
    'cb400000-0000-0000-0000-000000000001',
    'CBTP Settlement 1'
  ),
  (
    'cb500000-0000-0000-0000-000000000002',
    'cb400000-0000-0000-0000-000000000002',
    'CBTP Settlement 2'
  );

insert into
  public.resources (id, world_id, name, slug)
values
  (
    'cb600000-0000-0000-0000-000000000001',
    'cb200000-0000-0000-0000-000000000001',
    'CBTP Gold',
    'cbtp-gold'
  );

-- Nation manager citizens, one per nation.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    user_id,
    role_type,
    role_nation_id
  )
values
  (
    'cb700000-0000-0000-0000-000000000001',
    'cb200000-0000-0000-0000-000000000001',
    'cb500000-0000-0000-0000-000000000001',
    'player_character',
    'CBTP Nation Mgr 1',
    'alive',
    'cb100000-0000-0000-0000-000000000002',
    'nation_manager',
    'cb400000-0000-0000-0000-000000000001'
  ),
  (
    'cb700000-0000-0000-0000-000000000002',
    'cb200000-0000-0000-0000-000000000001',
    'cb500000-0000-0000-0000-000000000002',
    'player_character',
    'CBTP Nation Mgr 2',
    'alive',
    'cb100000-0000-0000-0000-000000000003',
    'nation_manager',
    'cb400000-0000-0000-0000-000000000002'
  );

-- Two active treaties: one expires this turn (trade_agreement, no terms
-- effect needed for this test), one stays active (tribute, referenced only
-- by id in the tribute_missed log payload — the RPC extension under test
-- does not itself move stockpiles, that's nationStockpileDeltas' job, see
-- apply_turn_transition_nation_economy_test.sql).
insert into
  public.nation_treaties (
    id,
    world_id,
    proposer_nation_id,
    responder_nation_id,
    treaty_type,
    terms,
    status,
    starts_turn_number,
    ends_turn_number
  )
values
  (
    'cb800000-0000-0000-0000-000000000001',
    'cb200000-0000-0000-0000-000000000001',
    'cb400000-0000-0000-0000-000000000001',
    'cb400000-0000-0000-0000-000000000002',
    'trade_agreement',
    '{}'::jsonb,
    'active',
    1,
    6
  ),
  (
    'cb800000-0000-0000-0000-000000000002',
    'cb200000-0000-0000-0000-000000000001',
    'cb400000-0000-0000-0000-000000000001',
    'cb400000-0000-0000-0000-000000000002',
    'tribute',
    jsonb_build_object(
      'payer',
      'proposer',
      'resource_id',
      'cb600000-0000-0000-0000-000000000001',
      'quantity_per_turn',
      10
    ),
    'active',
    1,
    null
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
    'cb300000-0000-0000-0000-000000000001',
    'cb200000-0000-0000-0000-000000000001',
    5,
    6,
    'cb100000-0000-0000-0000-000000000001',
    'running'
  );

-- ===========================================================================
-- TEST SCENARIO 1: expiry flips status, and both notification types reach
-- both nations (recipients per aff nation: its manager + world admin + super
-- admin; world admin/super admin dedupe across the two aff nations via the
-- notifications_transition_dedup_idx partial unique index, so 4 total rows
-- per notification type: nation mgr 1 + nation mgr 2 + world admin + super
-- admin).
-- ===========================================================================
set
  local role service_role;

select
  public.apply_turn_transition (
    'cb200000-0000-0000-0000-000000000001',
    5,
    jsonb_build_object(
      'treatyStatusChanges',
      jsonb_build_array(
        jsonb_build_object(
          'treatyId',
          'cb800000-0000-0000-0000-000000000001',
          'toStatus',
          'expired'
        )
      ),
      'logEntries',
      jsonb_build_array(
        jsonb_build_object(
          'category',
          'nation.treaty_expired',
          'nationId',
          'cb400000-0000-0000-0000-000000000001',
          'payload',
          jsonb_build_object(
            'proposerNationId',
            'cb400000-0000-0000-0000-000000000001',
            'responderNationId',
            'cb400000-0000-0000-0000-000000000002',
            'treatyId',
            'cb800000-0000-0000-0000-000000000001',
            'treatyType',
            'trade_agreement'
          )
        ),
        jsonb_build_object(
          'category',
          'nation.tribute_missed',
          'nationId',
          'cb400000-0000-0000-0000-000000000001',
          'payload',
          jsonb_build_object(
            'payerNationId',
            'cb400000-0000-0000-0000-000000000001',
            'payeeNationId',
            'cb400000-0000-0000-0000-000000000002',
            'resourceId',
            'cb600000-0000-0000-0000-000000000001',
            'quantityRequested',
            10,
            'quantityTransferred',
            4,
            'quantityMissing',
            6,
            'treatyId',
            'cb800000-0000-0000-0000-000000000002'
          )
        )
      )
    ),
    'cb300000-0000-0000-0000-000000000001'::uuid
  );

reset role;

select
  is (
    (
      select
        status
      from
        public.nation_treaties
      where
        id = 'cb800000-0000-0000-0000-000000000001'
    ),
    'expired',
    'expiry: treatyStatusChanges flips the treaty to expired'
  );

select
  is (
    (
      select
        status
      from
        public.nation_treaties
      where
        id = 'cb800000-0000-0000-0000-000000000002'
    ),
    'active',
    'expiry: the untouched tribute treaty stays active'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        world_id = 'cb200000-0000-0000-0000-000000000001'
        and notification_type = 'nation.treaty_expired'
    ),
    4,
    'nation.treaty_expired: 4 notifications (both nation mgrs + world admin + super admin, deduped)'
  );

select
  is (
    (
      select
        severity::text
      from
        public.notifications
      where
        world_id = 'cb200000-0000-0000-0000-000000000001'
        and notification_type = 'nation.treaty_expired'
        and recipient_user_id = 'cb100000-0000-0000-0000-000000000002'
    ),
    'info',
    'nation.treaty_expired: severity is info'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        world_id = 'cb200000-0000-0000-0000-000000000001'
        and notification_type = 'nation.tribute_missed'
    ),
    4,
    'nation.tribute_missed: 4 notifications (both nation mgrs + world admin + super admin, deduped)'
  );

select
  is (
    (
      select
        severity::text
      from
        public.notifications
      where
        world_id = 'cb200000-0000-0000-0000-000000000001'
        and notification_type = 'nation.tribute_missed'
        and recipient_user_id = 'cb100000-0000-0000-0000-000000000003'
    ),
    'warning',
    'nation.tribute_missed: severity is warning'
  );

-- ===========================================================================
-- TEST SCENARIO 2: cross-world guard rejects a treatyId from another world
-- ===========================================================================
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
    'cb300000-0000-0000-0000-000000000002',
    'cb200000-0000-0000-0000-000000000002',
    5,
    6,
    'cb100000-0000-0000-0000-000000000001',
    'running'
  );

set
  local role service_role;

select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'cb200000-0000-0000-0000-000000000002',
      5,
      jsonb_build_object(
        'treatyStatusChanges',
        jsonb_build_array(
          jsonb_build_object(
            'treatyId', 'cb800000-0000-0000-0000-000000000001',
            'toStatus', 'expired'
          )
        )
      ),
      'cb300000-0000-0000-0000-000000000002'::uuid
    )
    $test$,
    'P0001',
    null,
    'cross-world treatyId in treatyStatusChanges is rejected'
  );

reset role;

select
  *
from
  finish ();

rollback;
