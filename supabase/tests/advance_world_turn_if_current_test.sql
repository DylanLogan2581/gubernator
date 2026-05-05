-- pgTAP tests for public.advance_world_turn_if_current().
-- Run with: npx supabase test db
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
    '89000000-0000-0000-0000-000000000001',
    'advance-turn-owner@example.com',
    'x',
    now(),
    '{"username":"advance_turn_owner"}'::jsonb,
    now(),
    now()
  ),
  (
    '89000000-0000-0000-0000-000000000002',
    'advance-turn-admin@example.com',
    'x',
    now(),
    '{"username":"advance_turn_admin"}'::jsonb,
    now(),
    now()
  ),
  (
    '89000000-0000-0000-0000-000000000003',
    'advance-turn-outsider@example.com',
    'x',
    now(),
    '{"username":"advance_turn_outsider"}'::jsonb,
    now(),
    now()
  ),
  (
    '89000000-0000-0000-0000-000000000004',
    'advance-turn-superadmin@example.com',
    'x',
    now(),
    '{"username":"advance_turn_superadmin"}'::jsonb,
    now(),
    now()
  ),
  (
    '89000000-0000-0000-0000-000000000005',
    'advance-turn-suspended-admin@example.com',
    'x',
    now(),
    '{"username":"advance_turn_suspended_admin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = '89000000-0000-0000-0000-000000000004';

update public.users
set
  status = 'suspended'
where
  id = '89000000-0000-0000-0000-000000000005';

insert into
  public.worlds (
    id,
    name,
    owner_id,
    current_turn_number,
    visibility,
    status
  )
values
  (
    '8a000000-0000-0000-0000-000000000001',
    'Advance Turn World',
    '89000000-0000-0000-0000-000000000001',
    4,
    'private',
    'active'
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    '8a000000-0000-0000-0000-000000000001',
    '89000000-0000-0000-0000-000000000002'
  ),
  (
    '8a000000-0000-0000-0000-000000000001',
    '89000000-0000-0000-0000-000000000005'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    '8b000000-0000-0000-0000-000000000001',
    '8a000000-0000-0000-0000-000000000001',
    'Advance Turn Nation'
  );

insert into
  public.settlements (
    id,
    nation_id,
    name,
    auto_ready_enabled,
    is_ready_current_turn,
    last_ready_at,
    ready_set_at
  )
values
  (
    '8c000000-0000-0000-0000-000000000001',
    '8b000000-0000-0000-0000-000000000001',
    'Manual Ready Settlement',
    false,
    true,
    '2026-05-02 12:00:00+00',
    '2026-05-02 12:00:00+00'
  ),
  (
    '8c000000-0000-0000-0000-000000000002',
    '8b000000-0000-0000-0000-000000000001',
    'Auto Ready Settlement',
    true,
    false,
    '2026-05-02 12:05:00+00',
    '2026-05-02 12:05:00+00'
  ),
  (
    '8c000000-0000-0000-0000-000000000003',
    '8b000000-0000-0000-0000-000000000001',
    'Manual Not Ready Settlement',
    false,
    false,
    null,
    null
  );

-- ---------------------------------------------------------------------------
-- OWNER: matching expected turn advances exactly one turn.
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"89000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.advance_world_turn_if_current (
          '8a000000-0000-0000-0000-000000000001',
          4,
          '{
            "fromTurnNumber": 4,
            "toTurnNumber": 5,
            "previousDate": {
              "turnNumber": 4,
              "weekdayIndex": 0,
              "weekdayName": "Moonday",
              "dayOfMonth": 4,
              "monthIndex": 0,
              "monthName": "Frostmonth",
              "year": 12
            },
            "nextDate": {
              "turnNumber": 5,
              "weekdayIndex": 1,
              "weekdayName": "Toilsday",
              "dayOfMonth": 5,
              "monthIndex": 0,
              "monthName": "Frostmonth",
              "year": 12
            },
            "readinessSummary": {
              "totalSettlementCount": 3,
              "readySettlementCount": 2,
              "notReadySettlementCount": 1,
              "readyPercentage": 66.66666666666666
            }
          }'::jsonb,
          '{
            "notificationType": "turn.completed",
            "messageText": "World advanced to turn 5."
          }'::jsonb
        )
    ),
    1,
    'matching expected turn returns one completed transition'
  );

select
  is (
    (
      select
        current_turn_number
      from
        public.worlds
      where
        id = '8a000000-0000-0000-0000-000000000001'
    ),
    5,
    'matching expected turn advances the world exactly one turn'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.turn_transitions
      where
        world_id = '8a000000-0000-0000-0000-000000000001'
        and from_turn_number = 4
        and to_turn_number = 5
        and initiated_by_user_id = '89000000-0000-0000-0000-000000000001'
        and status = 'completed'
    ),
    1,
    'matching expected turn records the completed transition'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.turn_log_entries tle
        inner join public.turn_transitions tt on tt.id = tle.turn_transition_id
        and tt.world_id = tle.world_id
      where
        tle.world_id = '8a000000-0000-0000-0000-000000000001'
        and tt.from_turn_number = 4
        and tt.to_turn_number = 5
        and tle.log_category = 'basic_turn_advancement'
        and tle.payload_jsonb = '{
          "fromTurnNumber": 4,
          "toTurnNumber": 5,
          "previousDate": {
            "turnNumber": 4,
            "weekdayIndex": 0,
            "weekdayName": "Moonday",
            "dayOfMonth": 4,
            "monthIndex": 0,
            "monthName": "Frostmonth",
            "year": 12
          },
          "nextDate": {
            "turnNumber": 5,
            "weekdayIndex": 1,
            "weekdayName": "Toilsday",
            "dayOfMonth": 5,
            "monthIndex": 0,
            "monthName": "Frostmonth",
            "year": 12
          },
          "readinessSummary": {
            "totalSettlementCount": 3,
            "readySettlementCount": 2,
            "notReadySettlementCount": 1,
            "readyPercentage": 66.66666666666666
          }
        }'::jsonb
    ),
    1,
    'matching expected turn records one basic advancement log payload'
  );

reset role;

select
  is (
    (
      select
        count(distinct n.recipient_user_id)::integer
      from
        public.notifications n
        inner join public.turn_transitions tt on tt.id = n.generated_in_transition_id
        and tt.world_id = n.world_id
      where
        n.world_id = '8a000000-0000-0000-0000-000000000001'
        and tt.from_turn_number = 4
        and tt.to_turn_number = 5
        and n.notification_type = 'turn.completed'
        and n.message_text = 'World advanced to turn 5.'
    ),
    (
      select
        count(*)::integer
      from
        (
          select
            '89000000-0000-0000-0000-000000000001'::uuid as recipient_user_id
          union
          select
            '89000000-0000-0000-0000-000000000002'::uuid
          union
          select
            u.id
          from
            public.users u
          where
            u.is_super_admin = true
            and u.status = 'active'
        ) expected_recipients
    ),
    'matching expected turn writes one turn-completed notification for each active owner-admin and super-admin recipient'
  );

select
  ok (
    exists (
      select
        1
      from
        public.notifications n
        inner join public.turn_transitions tt on tt.id = n.generated_in_transition_id
        and tt.world_id = n.world_id
      where
        n.world_id = '8a000000-0000-0000-0000-000000000001'
        and tt.from_turn_number = 4
        and tt.to_turn_number = 5
        and n.recipient_user_id in (
          '89000000-0000-0000-0000-000000000001',
          '89000000-0000-0000-0000-000000000002',
          '89000000-0000-0000-0000-000000000004'
        )
    )
    and not exists (
      select
        1
      from
        public.notifications n
        inner join public.turn_transitions tt on tt.id = n.generated_in_transition_id
        and tt.world_id = n.world_id
      where
        n.world_id = '8a000000-0000-0000-0000-000000000001'
        and tt.from_turn_number = 4
        and tt.to_turn_number = 5
        and n.recipient_user_id in (
          '89000000-0000-0000-0000-000000000003',
          '89000000-0000-0000-0000-000000000005'
        )
    ),
    'turn-completed notifications exclude unrelated and inactive users'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.turn_log_entries
      where
        world_id = '8a000000-0000-0000-0000-000000000001'
        and log_category <> 'basic_turn_advancement'
    ),
    0,
    'basic advancement does not add audit or simulation outcome logs'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlements
      where
        nation_id = '8b000000-0000-0000-0000-000000000001'
        and auto_ready_enabled = false
        and is_ready_current_turn = false
    ),
    2,
    'non-auto-ready settlements reset to not ready after turn advance'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlements
      where
        nation_id = '8b000000-0000-0000-0000-000000000001'
        and auto_ready_enabled = false
        and ready_set_at is null
    ),
    2,
    'non-auto-ready settlements clear ready_set_at after turn advance'
  );

select
  ok (
    exists (
      select
        1
      from
        public.settlements
      where
        id = '8c000000-0000-0000-0000-000000000001'
        and is_ready_current_turn = false
        and ready_set_at is null
        and last_ready_at = '2026-05-02 12:00:00+00'::timestamptz
    ),
    'turn advance preserves historical last readiness for manually ready settlements'
  );

select
  is (
    (
      select
        is_ready_current_turn
      from
        public.settlements
      where
        id = '8c000000-0000-0000-0000-000000000002'
    ),
    true,
    'auto-ready settlements remain ready after turn advance'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlements
      where
        nation_id = '8b000000-0000-0000-0000-000000000001'
        and (
          auto_ready_enabled
          or is_ready_current_turn
        )
    ),
    1,
    'mixed settlements keep only auto-ready rows counted ready for the new turn'
  );

-- ---------------------------------------------------------------------------
-- STALE EXPECTED TURN: no world update and no second transition.
-- ---------------------------------------------------------------------------
select
  is (
    (
      select
        count(*)::integer
      from
        public.advance_world_turn_if_current ('8a000000-0000-0000-0000-000000000001', 4)
    ),
    0,
    'stale expected turn returns no transition'
  );

select
  is (
    (
      select
        current_turn_number
      from
        public.worlds
      where
        id = '8a000000-0000-0000-0000-000000000001'
    ),
    5,
    'stale expected turn does not advance the world'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.turn_transitions
      where
        world_id = '8a000000-0000-0000-0000-000000000001'
        and from_turn_number = 4
    ),
    1,
    'stale expected turn does not create another transition'
  );

-- ---------------------------------------------------------------------------
-- WORLD ADMIN: explicit admins may advance through the narrow RPC.
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"89000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.advance_world_turn_if_current ('8a000000-0000-0000-0000-000000000001', 5)
    ),
    1,
    'world admin can advance an administered world'
  );

select
  is (
    (
      select
        current_turn_number
      from
        public.worlds
      where
        id = '8a000000-0000-0000-0000-000000000001'
    ),
    6,
    'world admin advance still increments exactly one turn'
  );

reset role;

-- ---------------------------------------------------------------------------
-- FORCED FAILURE: transition is marked failed and world state rolls back.
-- ---------------------------------------------------------------------------
update public.settlements
set
  is_ready_current_turn = true,
  last_ready_at = '2026-05-03 14:00:00+00',
  ready_set_at = '2026-05-03 14:00:00+00'
where
  id = '8c000000-0000-0000-0000-000000000001';

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"89000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.advance_world_turn_if_current (
          '8a000000-0000-0000-0000-000000000001',
          6,
          null,
          '{
            "notificationType": "turn.completed"
          }'::jsonb
        ) transition_rows
      where
        transition_rows.status = 'failed'
    ),
    1,
    'forced failure returns one failed transition row'
  );

select
  is (
    (
      select
        current_turn_number
      from
        public.worlds
      where
        id = '8a000000-0000-0000-0000-000000000001'
    ),
    6,
    'forced failure rolls back the world turn advance'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.turn_transitions
      where
        world_id = '8a000000-0000-0000-0000-000000000001'
        and from_turn_number = 6
        and to_turn_number = 7
        and status = 'failed'
        and finished_at is null
    ),
    1,
    'forced failure stores one failed transition without finished_at'
  );

select
  ok (
    exists (
      select
        1
      from
        public.settlements
      where
        id = '8c000000-0000-0000-0000-000000000001'
        and is_ready_current_turn = true
        and last_ready_at = '2026-05-03 14:00:00+00'::timestamptz
        and ready_set_at = '2026-05-03 14:00:00+00'::timestamptz
    ),
    'forced failure preserves settlement readiness state'
  );

reset role;

-- ---------------------------------------------------------------------------
-- RUNNING CONFLICT: existing running transitions are reported, not completed.
-- ---------------------------------------------------------------------------
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
    '8d000000-0000-0000-0000-000000000099',
    '8a000000-0000-0000-0000-000000000001',
    6,
    7,
    '89000000-0000-0000-0000-000000000001',
    'running'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"89000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.advance_world_turn_if_current ('8a000000-0000-0000-0000-000000000001', 6) transition_rows
      where
        transition_rows.id = '8d000000-0000-0000-0000-000000000099'
        and transition_rows.status = 'running'
    ),
    1,
    'existing running transition is returned as running'
  );

select
  is (
    (
      select
        current_turn_number
      from
        public.worlds
      where
        id = '8a000000-0000-0000-0000-000000000001'
    ),
    6,
    'existing running transition does not advance the world'
  );

reset role;

-- ---------------------------------------------------------------------------
-- OUTSIDER: unauthorized callers cannot advance the world.
-- ---------------------------------------------------------------------------
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"89000000-0000-0000-0000-000000000003","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.advance_world_turn_if_current ('8a000000-0000-0000-0000-000000000001', 6)
    ),
    0,
    'outsider cannot advance an inaccessible world'
  );

reset role;

select
  is (
    (
      select
        current_turn_number
      from
        public.worlds
      where
        id = '8a000000-0000-0000-0000-000000000001'
    ),
    6,
    'outsider request does not advance the world'
  );

rollback;
