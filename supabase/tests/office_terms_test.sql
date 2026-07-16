-- pgTAP tests for #1123 (office terms with expiry): term_turns / expires_turn_number
-- set at appointment, turn-hook expiry archives the seat (ended_turn_number,
-- log entry, notification), indefinite offices never expire, renew_office
-- resets the term in place, and history stays queryable after expiry.
-- Run with: npx supabase test db
begin;

select
  plan (11);

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
    '9d000000-0000-0000-0000-000000000001',
    'terms-manager@example.com',
    'x',
    now(),
    '{"username":"terms_manager"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status, current_turn_number)
values
  (
    '9e000000-0000-0000-0000-000000000001',
    'Office Terms World',
    'active',
    10
  );

insert into
  public.nations (id, world_id, name, government_type)
values
  (
    '9f000000-0000-0000-0000-000000000001',
    '9e000000-0000-0000-0000-000000000001',
    'Term Republic',
    'republic'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    '9c000000-0000-0000-0000-000000000001',
    '9f000000-0000-0000-0000-000000000001',
    'Term Settlement'
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
    '9b000000-0000-0000-0000-000000000001',
    '9e000000-0000-0000-0000-000000000001',
    null,
    'player_character',
    'Manager',
    'alive',
    '9d000000-0000-0000-0000-000000000001',
    'nation_manager',
    '9f000000-0000-0000-0000-000000000001'
  ),
  (
    '9b000000-0000-0000-0000-000000000002',
    '9e000000-0000-0000-0000-000000000001',
    '9c000000-0000-0000-0000-000000000001',
    'npc',
    'Senator Aldric',
    'alive',
    null,
    'none',
    null
  ),
  (
    '9b000000-0000-0000-0000-000000000003',
    '9e000000-0000-0000-0000-000000000001',
    '9c000000-0000-0000-0000-000000000001',
    'npc',
    'Treasurer Beata',
    'alive',
    null,
    'none',
    null
  );

-- ===========================================================================
-- Appointment: an explicit term computes expires_turn_number; omitting the
-- term leaves the office indefinite.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"9d000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  public.appoint_nation_office (
    '9f000000-0000-0000-0000-000000000001'::uuid,
    'senator',
    '9b000000-0000-0000-0000-000000000002'::uuid,
    1
  );

select
  public.appoint_nation_office (
    '9f000000-0000-0000-0000-000000000001'::uuid,
    'treasurer',
    '9b000000-0000-0000-0000-000000000003'::uuid
  );

reset role;

select
  is (
    (
      select
        format('%s|%s', term_turns, expires_turn_number)
      from
        public.nation_offices
      where
        nation_id = '9f000000-0000-0000-0000-000000000001'
        and citizen_id = '9b000000-0000-0000-0000-000000000002'
    ),
    '1|11',
    'a 1-turn term appointed at turn 10 expires at turn 11'
  );

select
  is (
    (
      select
        format('%s|%s', term_turns, expires_turn_number)
      from
        public.nation_offices
      where
        nation_id = '9f000000-0000-0000-0000-000000000001'
        and citizen_id = '9b000000-0000-0000-0000-000000000003'
    ),
    '|',
    'an office appointed with no term is indefinite (both columns null)'
  );

-- ===========================================================================
-- Turn-hook expiry: advancing past turn 12 vacates the senator's seat
-- (archived via ended_turn_number, not deleted) and leaves the indefinite
-- treasurer seat untouched.
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
    '9a900000-0000-0000-0000-000000000001',
    '9e000000-0000-0000-0000-000000000001',
    10,
    11,
    '9d000000-0000-0000-0000-000000000001',
    'running'
  );

set
  local role service_role;

select
  public.apply_turn_transition (
    '9e000000-0000-0000-0000-000000000001',
    10,
    '{}'::jsonb,
    '9a900000-0000-0000-0000-000000000001'::uuid
  );

reset role;

select
  is (
    (
      select
        ended_turn_number
      from
        public.nation_offices
      where
        nation_id = '9f000000-0000-0000-0000-000000000001'
        and citizen_id = '9b000000-0000-0000-0000-000000000002'
    ),
    11,
    'the expired term is archived with ended_turn_number = the new turn'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_offices
      where
        nation_id = '9f000000-0000-0000-0000-000000000001'
        and citizen_id = '9b000000-0000-0000-0000-000000000002'
    ),
    1,
    'the archived row is kept (not deleted) so rosters can show history'
  );

select
  is (
    (
      select
        ended_turn_number
      from
        public.nation_offices
      where
        nation_id = '9f000000-0000-0000-0000-000000000001'
        and citizen_id = '9b000000-0000-0000-0000-000000000003'
    ),
    null,
    'the indefinite treasurer office never expires'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.turn_log_entries
      where
        turn_transition_id = '9a900000-0000-0000-0000-000000000001'
        and log_category = 'office.term_ended'
        and (payload_jsonb ->> 'citizenId')::uuid = '9b000000-0000-0000-0000-000000000002'
    ),
    1,
    'expiry writes a turn_log_entries row'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.notifications
      where
        generated_in_transition_id = '9a900000-0000-0000-0000-000000000001'
        and notification_type = 'office.term_ended'
        and recipient_user_id = '9d000000-0000-0000-0000-000000000001'
    ),
    1,
    'expiry notifies the nation manager'
  );

-- ===========================================================================
-- History stays queryable, and a re-appoint of the same citizen to the same
-- office succeeds now that the prior row is archived (ended_turn_number is
-- excluded from the active-officeholder uniqueness index).
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"9d000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  public.appoint_nation_office (
    '9f000000-0000-0000-0000-000000000001'::uuid,
    'senator',
    '9b000000-0000-0000-0000-000000000002'::uuid
  );

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_offices
      where
        nation_id = '9f000000-0000-0000-0000-000000000001'
        and citizen_id = '9b000000-0000-0000-0000-000000000002'
    ),
    2,
    're-appointing the same citizen after expiry adds a fresh active row alongside the archived one'
  );

-- ===========================================================================
-- renew_office: re-appoints the active treasurer in place with a fresh
-- term, bumping appointed_turn_number to the world's current turn.
-- ===========================================================================
select
  set_config(
    'gubernator.test_treasurer_office_id',
    (
      select
        id::text
      from
        public.nation_offices
      where
        nation_id = '9f000000-0000-0000-0000-000000000001'
        and citizen_id = '9b000000-0000-0000-0000-000000000003'
    ),
    false
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"9d000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  public.renew_office (
    current_setting('gubernator.test_treasurer_office_id')::uuid,
    5
  );

reset role;

select
  is (
    (
      select
        format(
          '%s|%s|%s',
          appointed_turn_number,
          term_turns,
          expires_turn_number
        )
      from
        public.nation_offices
      where
        id = current_setting('gubernator.test_treasurer_office_id')::uuid
    ),
    '11|5|16',
    'renew_office resets appointed_turn_number to the current turn and recomputes expires_turn_number'
  );

-- ===========================================================================
-- renew_office rejects an already-ended office.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"9d000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.renew_office(
      (
        select id from public.nation_offices
        where nation_id = '9f000000-0000-0000-0000-000000000001'
          and citizen_id = '9b000000-0000-0000-0000-000000000002'
          and ended_turn_number is not null
      ),
      null
    )
  $test$,
    '22023',
    null,
    'renew_office refuses an office whose term has already ended'
  );

reset role;

-- ===========================================================================
-- Authority: a user with no authority over the nation cannot renew.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"9b000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    select public.renew_office(
      current_setting('gubernator.test_treasurer_office_id')::uuid,
      null
    )
  $test$,
    '42501',
    null,
    'a user with no authority over the nation cannot renew an office'
  );

reset role;

select
  *
from
  finish ();

rollback;
