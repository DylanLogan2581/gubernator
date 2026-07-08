-- pgTAP tests for nation_treaties lifecycle RPCs (#1089):
-- propose_nation_treaty, respond_to_nation_treaty, withdraw_nation_treaty,
-- break_nation_treaty. Covers authority, met/at_war guards, per-type term
-- validation, full lifecycle transitions, and break notifications.
-- Run with: npx supabase test db
--
-- UUID ranges (all hex, unique to this file):
--   e1000000 = users        e2000000 = worlds
--   e3000000 = nations      e4000000 = settlements
--   e5000000 = citizens     e6000000 = resources
begin;

select
  plan (25);

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
    'e1000000-0000-0000-0000-000000000001',
    'treaty-mgr-a@example.com',
    'x',
    now(),
    '{"username":"treaty_mgr_a"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000002',
    'treaty-mgr-b@example.com',
    'x',
    now(),
    '{"username":"treaty_mgr_b"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000003',
    'treaty-mgr-c@example.com',
    'x',
    now(),
    '{"username":"treaty_mgr_c"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000004',
    'treaty-mgr-d@example.com',
    'x',
    now(),
    '{"username":"treaty_mgr_d"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000005',
    'treaty-archived-admin@example.com',
    'x',
    now(),
    '{"username":"treaty_archived_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    'e1000000-0000-0000-0000-000000000009',
    'treaty-outsider@example.com',
    'x',
    now(),
    '{"username":"treaty_outsider"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status, archived_at)
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'Treaty World',
    'private',
    'active',
    null
  ),
  (
    'e2000000-0000-0000-0000-000000000002',
    'Treaty Archived World',
    'private',
    'archived',
    now()
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'e2000000-0000-0000-0000-000000000002',
    'e1000000-0000-0000-0000-000000000005'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'e3000000-0000-0000-0000-00000000000a',
    'e2000000-0000-0000-0000-000000000001',
    'Nation A'
  ),
  (
    'e3000000-0000-0000-0000-00000000000b',
    'e2000000-0000-0000-0000-000000000001',
    'Nation B'
  ),
  (
    'e3000000-0000-0000-0000-00000000000c',
    'e2000000-0000-0000-0000-000000000001',
    'Nation C (unmet)'
  ),
  (
    'e3000000-0000-0000-0000-00000000000d',
    'e2000000-0000-0000-0000-000000000001',
    'Nation D (at war)'
  ),
  (
    'e3000000-0000-0000-0000-00000000000e',
    'e2000000-0000-0000-0000-000000000002',
    'Archived Nation A'
  ),
  (
    'e3000000-0000-0000-0000-00000000000f',
    'e2000000-0000-0000-0000-000000000002',
    'Archived Nation B'
  );

-- A has met B and D, not C.
insert into
  public.nation_discoveries (
    world_id,
    nation_a_id,
    nation_b_id,
    met_at_turn_number
  )
values
  (
    'e2000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-00000000000a',
    'e3000000-0000-0000-0000-00000000000b',
    1
  ),
  (
    'e2000000-0000-0000-0000-000000000001',
    'e3000000-0000-0000-0000-00000000000a',
    'e3000000-0000-0000-0000-00000000000d',
    1
  ),
  (
    'e2000000-0000-0000-0000-000000000002',
    'e3000000-0000-0000-0000-00000000000e',
    'e3000000-0000-0000-0000-00000000000f',
    1
  );

-- A and D are at war.
insert into
  public.nation_relationships (from_nation_id, to_nation_id, current_stance)
values
  (
    'e3000000-0000-0000-0000-00000000000a',
    'e3000000-0000-0000-0000-00000000000d',
    'at_war'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'e4000000-0000-0000-0000-00000000000a',
    'e3000000-0000-0000-0000-00000000000a',
    'Settlement A'
  ),
  (
    'e4000000-0000-0000-0000-00000000000b',
    'e3000000-0000-0000-0000-00000000000b',
    'Settlement B'
  ),
  (
    'e4000000-0000-0000-0000-00000000000c',
    'e3000000-0000-0000-0000-00000000000c',
    'Settlement C'
  ),
  (
    'e4000000-0000-0000-0000-00000000000d',
    'e3000000-0000-0000-0000-00000000000d',
    'Settlement D'
  ),
  (
    'e4000000-0000-0000-0000-00000000000e',
    'e3000000-0000-0000-0000-00000000000e',
    'Archived Settlement A'
  ),
  (
    'e4000000-0000-0000-0000-00000000000f',
    'e3000000-0000-0000-0000-00000000000f',
    'Archived Settlement B'
  );

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
    'e5000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-00000000000a',
    'player_character',
    'Manager A',
    'alive',
    'e1000000-0000-0000-0000-000000000001',
    'nation_manager',
    'e3000000-0000-0000-0000-00000000000a'
  ),
  (
    'e5000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-00000000000b',
    'player_character',
    'Manager B',
    'alive',
    'e1000000-0000-0000-0000-000000000002',
    'nation_manager',
    'e3000000-0000-0000-0000-00000000000b'
  ),
  (
    'e5000000-0000-0000-0000-000000000003',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-00000000000c',
    'player_character',
    'Manager C',
    'alive',
    'e1000000-0000-0000-0000-000000000003',
    'nation_manager',
    'e3000000-0000-0000-0000-00000000000c'
  ),
  (
    'e5000000-0000-0000-0000-000000000004',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-00000000000d',
    'player_character',
    'Manager D',
    'alive',
    'e1000000-0000-0000-0000-000000000004',
    'nation_manager',
    'e3000000-0000-0000-0000-00000000000d'
  );

-- Plain (non-manager) citizens for royal_marriage terms.
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
    'e5000000-0000-0000-0000-000000000007',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-00000000000a',
    'npc',
    'Royal A',
    'alive'
  ),
  (
    'e5000000-0000-0000-0000-000000000008',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-00000000000b',
    'npc',
    'Royal B',
    'alive'
  );

insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status,
    death_cause_category
  )
values
  (
    'e5000000-0000-0000-0000-000000000009',
    'e2000000-0000-0000-0000-000000000001',
    'e4000000-0000-0000-0000-00000000000b',
    'npc',
    'Royal B Dead',
    'dead',
    'unknown'
  );

insert into
  public.resources (
    id,
    world_id,
    name,
    slug,
    base_stockpile_cap,
    is_trashed
  )
values
  (
    'e6000000-0000-0000-0000-000000000001',
    'e2000000-0000-0000-0000-000000000001',
    'Treaty Grain',
    'treaty-grain',
    1000,
    false
  ),
  (
    'e6000000-0000-0000-0000-000000000002',
    'e2000000-0000-0000-0000-000000000001',
    'Treaty Trashed',
    'treaty-trashed',
    1000,
    true
  );

-- ===========================================================================
-- propose_nation_treaty: outsider cannot propose.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000009","role":"authenticated"}';

select
  throws_ok (
    $test$
  select public.propose_nation_treaty(
    'e3000000-0000-0000-0000-00000000000a'::uuid,
    'e3000000-0000-0000-0000-00000000000b'::uuid,
    'trade_agreement',
    '{}'::jsonb,
    'e5000000-0000-0000-0000-000000000001'::uuid
  )
  $test$,
    '42501',
    null,
    'outsider cannot propose a treaty'
  );

reset role;

-- ===========================================================================
-- propose_nation_treaty: nations that have not met are rejected.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
  select public.propose_nation_treaty(
    'e3000000-0000-0000-0000-00000000000a'::uuid,
    'e3000000-0000-0000-0000-00000000000c'::uuid,
    'trade_agreement',
    '{}'::jsonb,
    'e5000000-0000-0000-0000-000000000001'::uuid
  )
  $test$,
    'P0001',
    'Nations have not met.',
    'propose is rejected when nations have not met'
  );

-- ===========================================================================
-- propose_nation_treaty: at_war nations are rejected.
-- ===========================================================================
select
  throws_ok (
    $test$
  select public.propose_nation_treaty(
    'e3000000-0000-0000-0000-00000000000a'::uuid,
    'e3000000-0000-0000-0000-00000000000d'::uuid,
    'trade_agreement',
    '{}'::jsonb,
    'e5000000-0000-0000-0000-000000000001'::uuid
  )
  $test$,
    'P0001',
    'nations are at war',
    'propose is rejected while nations are at war'
  );

-- ===========================================================================
-- propose_nation_treaty: archived world is read-only.
-- ===========================================================================
reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000005","role":"authenticated"}';

select
  throws_ok (
    $test$
  select public.propose_nation_treaty(
    'e3000000-0000-0000-0000-00000000000e'::uuid,
    'e3000000-0000-0000-0000-00000000000f'::uuid,
    'trade_agreement',
    '{}'::jsonb,
    'e5000000-0000-0000-0000-000000000001'::uuid
  )
  $test$,
    '22023',
    'Archived worlds are read-only.',
    'propose is rejected in an archived world'
  );

reset role;

-- ===========================================================================
-- tribute term validation.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
  select public.propose_nation_treaty(
    'e3000000-0000-0000-0000-00000000000a'::uuid,
    'e3000000-0000-0000-0000-00000000000b'::uuid,
    'tribute',
    '{"payer":"sideways","resource_id":"e6000000-0000-0000-0000-000000000001","quantity_per_turn":5}'::jsonb,
    'e5000000-0000-0000-0000-000000000001'::uuid
  )
  $test$,
    'P0001',
    'tribute terms.payer must be ''proposer'' or ''responder''',
    'tribute rejects an invalid payer'
  );

select
  throws_ok (
    $test$
  select public.propose_nation_treaty(
    'e3000000-0000-0000-0000-00000000000a'::uuid,
    'e3000000-0000-0000-0000-00000000000b'::uuid,
    'tribute',
    '{"payer":"proposer","resource_id":"e6000000-0000-0000-0000-000000000002","quantity_per_turn":5}'::jsonb,
    'e5000000-0000-0000-0000-000000000001'::uuid
  )
  $test$,
    'P0001',
    'resource is trashed',
    'tribute rejects a trashed resource'
  );

create temporary table t_tribute_ok as
select
  *
from
  public.propose_nation_treaty (
    'e3000000-0000-0000-0000-00000000000a'::uuid,
    'e3000000-0000-0000-0000-00000000000b'::uuid,
    'tribute',
    '{"payer":"proposer","resource_id":"e6000000-0000-0000-0000-000000000001","quantity_per_turn":5}'::jsonb,
    'e5000000-0000-0000-0000-000000000001'::uuid
  );

select
  is (
    (
      select
        status
      from
        t_tribute_ok
    ),
    'proposed',
    'valid tribute proposal is created with status proposed'
  );

-- ===========================================================================
-- trade_agreement term validation: non-empty terms are rejected.
-- ===========================================================================
select
  throws_ok (
    $test$
  select public.propose_nation_treaty(
    'e3000000-0000-0000-0000-00000000000a'::uuid,
    'e3000000-0000-0000-0000-00000000000b'::uuid,
    'trade_agreement',
    '{"unexpected":true}'::jsonb,
    'e5000000-0000-0000-0000-000000000001'::uuid
  )
  $test$,
    'P0001',
    'trade_agreement terms must be an empty object',
    'trade_agreement rejects non-empty terms'
  );

-- ===========================================================================
-- royal_marriage term validation.
-- ===========================================================================
select
  throws_ok (
    $test$
  select public.propose_nation_treaty(
    'e3000000-0000-0000-0000-00000000000a'::uuid,
    'e3000000-0000-0000-0000-00000000000b'::uuid,
    'royal_marriage',
    ('{"citizen_a_id":"e5000000-0000-0000-0000-000000000007","citizen_b_id":"' || 'e5000000-0000-0000-0000-000000000009' || '"}')::jsonb,
    'e5000000-0000-0000-0000-000000000001'::uuid
  )
  $test$,
    'P0001',
    'royal_marriage requires two living citizens',
    'royal_marriage rejects a dead citizen'
  );

select
  throws_ok (
    $test$
  select public.propose_nation_treaty(
    'e3000000-0000-0000-0000-00000000000a'::uuid,
    'e3000000-0000-0000-0000-00000000000b'::uuid,
    'royal_marriage',
    ('{"citizen_a_id":"e5000000-0000-0000-0000-000000000007","citizen_b_id":"' || 'e5000000-0000-0000-0000-000000000003' || '"}')::jsonb,
    'e5000000-0000-0000-0000-000000000001'::uuid
  )
  $test$,
    'P0001',
    'royal_marriage citizens must belong one to each treaty nation',
    'royal_marriage rejects a citizen from a third nation'
  );

create temporary table t_marriage_ok as
select
  *
from
  public.propose_nation_treaty (
    'e3000000-0000-0000-0000-00000000000a'::uuid,
    'e3000000-0000-0000-0000-00000000000b'::uuid,
    'royal_marriage',
    (
      '{"citizen_a_id":"e5000000-0000-0000-0000-000000000007","citizen_b_id":"' || 'e5000000-0000-0000-0000-000000000008' || '"}'
    )::jsonb,
    'e5000000-0000-0000-0000-000000000001'::uuid
  );

select
  is (
    (
      select
        status
      from
        t_marriage_ok
    ),
    'proposed',
    'valid royal_marriage proposal is created with status proposed'
  );

-- ===========================================================================
-- currency_exchange: rejected until currencies exist.
-- ===========================================================================
select
  throws_ok (
    $test$
  select public.propose_nation_treaty(
    'e3000000-0000-0000-0000-00000000000a'::uuid,
    'e3000000-0000-0000-0000-00000000000b'::uuid,
    'currency_exchange',
    '{"rate":1,"currency_a_id":"e6000000-0000-0000-0000-000000000001","currency_b_id":"e6000000-0000-0000-0000-000000000002"}'::jsonb,
    'e5000000-0000-0000-0000-000000000001'::uuid
  )
  $test$,
    'P0001',
    'currency exchange treaties are not supported until currencies exist',
    'currency_exchange is rejected outright'
  );

reset role;

-- ===========================================================================
-- respond_to_nation_treaty: only the responder nation's manager may respond.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    format(
      $test$select public.respond_to_nation_treaty('%s'::uuid, 'accept', 'e5000000-0000-0000-0000-000000000001'::uuid)$test$,
      (
        select
          id
        from
          t_tribute_ok
      )
    ),
    '42501',
    null,
    'the proposer cannot respond to their own proposal'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

create temporary table t_tribute_accepted as
select
  public.respond_to_nation_treaty (
    (
      select
        id
      from
        t_tribute_ok
    ),
    'accept',
    'e5000000-0000-0000-0000-000000000002'::uuid
  ) as treaty;

select
  is (
    (
      select
        (treaty).status
      from
        t_tribute_accepted
    ),
    'active',
    'accept moves the treaty to active'
  );

select
  isnt (
    (
      select
        (treaty).starts_turn_number
      from
        t_tribute_accepted
    ),
    null,
    'accept stamps starts_turn_number'
  );

create temporary table t_marriage_declined as
select
  public.respond_to_nation_treaty (
    (
      select
        id
      from
        t_marriage_ok
    ),
    'decline',
    'e5000000-0000-0000-0000-000000000002'::uuid
  ) as treaty;

select
  is (
    (
      select
        (treaty).status
      from
        t_marriage_declined
    ),
    'declined',
    'decline moves the treaty to declined'
  );

reset role;

-- ===========================================================================
-- withdraw_nation_treaty: only a proposed treaty can be withdrawn, only by
-- the proposer's manager.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

create temporary table t_withdraw_source as
select
  *
from
  public.propose_nation_treaty (
    'e3000000-0000-0000-0000-00000000000a'::uuid,
    'e3000000-0000-0000-0000-00000000000b'::uuid,
    'trade_agreement',
    '{}'::jsonb,
    'e5000000-0000-0000-0000-000000000001'::uuid
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    format(
      $test$select public.withdraw_nation_treaty('%s'::uuid)$test$,
      (
        select
          id
        from
          t_withdraw_source
      )
    ),
    '42501',
    null,
    'the responder cannot withdraw the proposer''s proposal'
  );

reset role;

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000001","role":"authenticated"}';

create temporary table t_withdrawn as
select
  *
from
  public.withdraw_nation_treaty (
    (
      select
        id
      from
        t_withdraw_source
    )
  );

select
  is (
    (
      select
        status
      from
        t_withdrawn
    ),
    'withdrawn',
    'withdraw moves a proposed treaty to withdrawn'
  );

select
  throws_ok (
    format(
      $test$select public.withdraw_nation_treaty('%s'::uuid)$test$,
      (
        select
          id
        from
          t_withdraw_source
      )
    ),
    'P0001',
    'only a proposed treaty can be withdrawn',
    'withdrawing an already-withdrawn treaty is rejected'
  );

reset role;

-- ===========================================================================
-- break_nation_treaty: only an active treaty can be broken, by either side's
-- manager, and it notifies both nations' managers.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000009","role":"authenticated"}';

select
  throws_ok (
    format(
      $test$select public.break_nation_treaty('%s'::uuid, 'e5000000-0000-0000-0000-000000000002'::uuid)$test$,
      (
        select
          id
        from
          t_tribute_ok
      )
    ),
    '42501',
    null,
    'an outsider cannot break a treaty'
  );

reset role;

-- responder's manager breaks the active tribute treaty.
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

create temporary table t_broken as
select
  *
from
  public.break_nation_treaty (
    (
      select
        id
      from
        t_tribute_ok
    ),
    'e5000000-0000-0000-0000-000000000002'::uuid
  );

reset role;

select
  is (
    (
      select
        status
      from
        t_broken
    ),
    'broken',
    'break moves an active treaty to broken'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.notifications
      where
        notification_type = 'nation.treaty_broken'
        and nation_id = 'e3000000-0000-0000-0000-00000000000a'
    ),
    1,
    'break_nation_treaty notifies the proposer nation'
  );

select
  is (
    (
      select
        count(*)::int
      from
        public.notifications
      where
        notification_type = 'nation.treaty_broken'
        and nation_id = 'e3000000-0000-0000-0000-00000000000b'
    ),
    1,
    'break_nation_treaty notifies the responder nation'
  );

select
  is (
    (
      select
        recipient_user_id
      from
        public.notifications
      where
        notification_type = 'nation.treaty_broken'
        and nation_id = 'e3000000-0000-0000-0000-00000000000a'
    ),
    'e1000000-0000-0000-0000-000000000001'::uuid,
    'the proposer nation notification targets its nation manager'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"e1000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    format(
      $test$select public.break_nation_treaty('%s'::uuid, 'e5000000-0000-0000-0000-000000000002'::uuid)$test$,
      (
        select
          id
        from
          t_tribute_ok
      )
    ),
    'P0001',
    'only an active treaty can be broken',
    'breaking an already-broken treaty is rejected'
  );

reset role;

select
  *
from
  finish ();

rollback;
