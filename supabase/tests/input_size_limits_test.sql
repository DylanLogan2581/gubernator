-- pgTAP tests for input size limits added in
-- 20260519000004_add_input_size_limits.sql.
-- Run with: npx supabase test db
begin;

select
  plan (24);

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
    'a1000000-0000-0000-0000-000000000001',
    'limits-owner@example.com',
    'x',
    now(),
    '{"username":"limits_owner"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, visibility, status)
values
  (
    'a2000000-0000-0000-0000-000000000001',
    'Limits World',
    'private',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'a3000000-0000-0000-0000-000000000001',
    'a2000000-0000-0000-0000-000000000001',
    'Limits Nation'
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'a4000000-0000-0000-0000-000000000001',
    'a3000000-0000-0000-0000-000000000001',
    'Limits Settlement'
  );

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
    'a5000000-0000-0000-0000-000000000001',
    'a2000000-0000-0000-0000-000000000001',
    0,
    1,
    'a1000000-0000-0000-0000-000000000001',
    'completed',
    now()
  );

-- ---------------------------------------------------------------------------
-- worlds.name length cap
-- ---------------------------------------------------------------------------
select
  lives_ok (
    $test$
    insert into public.worlds (name)
    values (repeat('w', 64))
  $test$,
    'world name at 64 chars is accepted'
  );

select
  throws_ok (
    $test$
    insert into public.worlds (name)
    values (repeat('w', 65))
  $test$,
    '23514',
    null,
    'world name over 64 chars is rejected'
  );

-- ---------------------------------------------------------------------------
-- nations.name / nations.description length cap
-- ---------------------------------------------------------------------------
select
  lives_ok (
    $test$
    insert into public.nations (world_id, name, description)
    values (
      'a2000000-0000-0000-0000-000000000001',
      repeat('n', 64),
      repeat('d', 1000)
    )
  $test$,
    'nation name at 64 and description at 1000 chars accepted'
  );

select
  throws_ok (
    $test$
    insert into public.nations (world_id, name)
    values (
      'a2000000-0000-0000-0000-000000000001',
      repeat('n', 65)
    )
  $test$,
    '23514',
    null,
    'nation name over 64 chars rejected'
  );

select
  throws_ok (
    $test$
    insert into public.nations (world_id, name, description)
    values (
      'a2000000-0000-0000-0000-000000000001',
      'Bounded Nation',
      repeat('d', 1001)
    )
  $test$,
    '23514',
    null,
    'nation description over 1000 chars rejected'
  );

-- ---------------------------------------------------------------------------
-- settlements.name / settlements.description length cap
-- ---------------------------------------------------------------------------
select
  lives_ok (
    $test$
    insert into public.settlements (nation_id, name, description)
    values (
      'a3000000-0000-0000-0000-000000000001',
      repeat('s', 64),
      repeat('d', 1000)
    )
  $test$,
    'settlement name at 64 and description at 1000 chars accepted'
  );

select
  throws_ok (
    $test$
    insert into public.settlements (nation_id, name)
    values (
      'a3000000-0000-0000-0000-000000000001',
      repeat('s', 65)
    )
  $test$,
    '23514',
    null,
    'settlement name over 64 chars rejected'
  );

select
  throws_ok (
    $test$
    insert into public.settlements (nation_id, name, description)
    values (
      'a3000000-0000-0000-0000-000000000001',
      'Bounded Settlement',
      repeat('d', 1001)
    )
  $test$,
    '23514',
    null,
    'settlement description over 1000 chars rejected'
  );

-- ---------------------------------------------------------------------------
-- notifications.message_text length cap. The notification_type column is also
-- bounded to 32 chars as defense in depth, but the allowlist constraint added
-- in 20260519000003 keeps it well within that bound, so the length check is
-- not directly observable from inserts here.
-- ---------------------------------------------------------------------------
select
  lives_ok (
    $test$
    insert into public.notifications (
      recipient_user_id,
      world_id,
      notification_type,
      message_text
    )
    values (
      'a1000000-0000-0000-0000-000000000001',
      'a2000000-0000-0000-0000-000000000001',
      'turn.completed',
      repeat('m', 500)
    )
  $test$,
    'notification message_text at 500 chars accepted'
  );

select
  throws_ok (
    $test$
    insert into public.notifications (
      recipient_user_id,
      world_id,
      notification_type,
      message_text
    )
    values (
      'a1000000-0000-0000-0000-000000000001',
      'a2000000-0000-0000-0000-000000000001',
      'turn.completed',
      repeat('m', 501)
    )
  $test$,
    '23514',
    null,
    'notification message_text over 500 chars rejected'
  );

-- ---------------------------------------------------------------------------
-- turn_log_entries payload size and log_category cap
-- ---------------------------------------------------------------------------
select
  lives_ok (
    $test$
    insert into public.turn_log_entries (
      turn_transition_id,
      world_id,
      log_category,
      payload_jsonb
    )
    values (
      'a5000000-0000-0000-0000-000000000001',
      'a2000000-0000-0000-0000-000000000001',
      'basic_turn_advancement',
      jsonb_build_object('note', repeat('p', 1024))
    )
  $test$,
    'turn log payload well under 32KB accepted'
  );

select
  throws_ok (
    $test$
    insert into public.turn_log_entries (
      turn_transition_id,
      world_id,
      log_category,
      payload_jsonb
    )
    values (
      'a5000000-0000-0000-0000-000000000001',
      'a2000000-0000-0000-0000-000000000001',
      'basic_turn_advancement',
      jsonb_build_object('blob', repeat('p', 40000))
    )
  $test$,
    '23514',
    null,
    'turn log payload over 32KB rejected'
  );

select
  throws_ok (
    $test$
    insert into public.turn_log_entries (
      turn_transition_id,
      world_id,
      log_category
    )
    values (
      'a5000000-0000-0000-0000-000000000001',
      'a2000000-0000-0000-0000-000000000001',
      repeat('c', 65)
    )
  $test$,
    '23514',
    null,
    'turn log log_category over 64 chars rejected'
  );

-- ---------------------------------------------------------------------------
-- Calendar config bounds
-- ---------------------------------------------------------------------------
-- Maximum counts
select
  ok (
    not public.is_valid_calendar_config (
      jsonb_set(
        public.default_calendar_config (),
        '{weekdays}',
        (
          select
            jsonb_agg(jsonb_build_object('index', i, 'name', 'D' || i))
          from
            generate_series(0, 32) as t (i)
        )
      )
    ),
    'calendar with 33 weekdays is rejected'
  );

select
  ok (
    public.is_valid_calendar_config (
      jsonb_set(
        public.default_calendar_config (),
        '{weekdays}',
        (
          select
            jsonb_agg(jsonb_build_object('index', i, 'name', 'D' || i))
          from
            generate_series(0, 31) as t (i)
        )
      )
    ),
    'calendar with 32 weekdays is accepted'
  );

select
  ok (
    not public.is_valid_calendar_config (
      jsonb_set(
        public.default_calendar_config (),
        '{months}',
        (
          select
            jsonb_agg(
              jsonb_build_object('index', i, 'name', 'M' || i, 'dayCount', 30)
            )
          from
            generate_series(0, 32) as t (i)
        )
      )
    ),
    'calendar with 33 months is rejected'
  );

-- Month dayCount cap
select
  ok (
    not public.is_valid_calendar_config (
      jsonb_set(
        public.default_calendar_config (),
        '{months,0,dayCount}',
        '1001'::jsonb
      )
    ),
    'calendar with month dayCount > 1000 is rejected'
  );

select
  ok (
    public.is_valid_calendar_config (
      jsonb_set(
        public.default_calendar_config (),
        '{months,0,dayCount}',
        '1000'::jsonb
      )
    ),
    'calendar with month dayCount = 1000 is accepted'
  );

-- Item name length cap
select
  ok (
    not public.is_valid_calendar_config (
      jsonb_set(
        public.default_calendar_config (),
        '{weekdays,0,name}',
        to_jsonb(repeat('x', 65))
      )
    ),
    'calendar weekday name over 64 chars is rejected'
  );

select
  ok (
    not public.is_valid_calendar_config (
      jsonb_set(
        public.default_calendar_config (),
        '{months,0,name}',
        to_jsonb(repeat('x', 65))
      )
    ),
    'calendar month name over 64 chars is rejected'
  );

-- Template length cap
select
  ok (
    not public.is_valid_calendar_config (
      jsonb_set(
        public.default_calendar_config (),
        '{dateFormatTemplate}',
        to_jsonb('{year} ' || repeat('x', 195))
      )
    ),
    'calendar dateFormatTemplate over 200 chars is rejected'
  );

-- Starting year bounds
select
  ok (
    not public.is_valid_calendar_config (
      jsonb_set(
        public.default_calendar_config (),
        '{startingYear}',
        '1000001'::jsonb
      )
    ),
    'calendar startingYear above 1,000,000 is rejected'
  );

select
  ok (
    not public.is_valid_calendar_config (
      jsonb_set(
        public.default_calendar_config (),
        '{startingYear}',
        '-1000001'::jsonb
      )
    ),
    'calendar startingYear below -1,000,000 is rejected'
  );

select
  ok (
    public.is_valid_calendar_config (
      jsonb_set(
        public.default_calendar_config (),
        '{startingYear}',
        '1000000'::jsonb
      )
    ),
    'calendar startingYear at 1,000,000 is accepted'
  );

rollback;
