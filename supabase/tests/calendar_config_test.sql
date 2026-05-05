-- pgTAP tests for worlds.calendar_config_json validation.
-- Run with: npx supabase test db
begin;

select
  plan (10);

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
    '51000000-0000-0000-0000-000000000001',
    'calendar-owner@example.com',
    'x',
    now(),
    '{"username":"calendar_owner"}'::jsonb,
    now(),
    now()
  );

select
  ok (
    public.is_valid_calendar_config (public.default_calendar_config ()),
    'default calendar config is valid'
  );

select
  ok (
    public.is_valid_calendar_config (
      '{
        "weekdays": [
          { "index": 0, "name": "Moonday" }
        ],
        "months": [
          { "index": 0, "name": "Frostmonth", "dayCount": 30 }
        ],
        "startingMonthIndex": 0,
        "startingDayOfMonth": 1,
        "startingYear": -10,
        "startingWeekdayOffset": 0,
        "dateFormatTemplate": "{weekday}, {month} {day}, Year {year}"
      }'::jsonb
    ),
    'minimal valid calendar config accepts non-positive years'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.worlds
      where
        public.is_valid_calendar_config (calendar_config_json)
    ),
    (
      select
        count(*)::integer
      from
        public.worlds
    ),
    'all existing worlds have valid calendar configs'
  );

select
  lives_ok (
    $test$
    insert into public.worlds (id, name, owner_id, visibility, status)
    values (
      '52000000-0000-0000-0000-000000000001',
      'Default Calendar World',
      '51000000-0000-0000-0000-000000000001',
      'private',
      'active'
    )
  $test$,
    'world insert without explicit calendar config receives a valid default'
  );

select
  throws_ok (
    $test$
    insert into public.worlds (name, owner_id, calendar_config_json)
    values (
      'Invalid Weekday World',
      '51000000-0000-0000-0000-000000000001',
      jsonb_set(public.default_calendar_config(), '{weekdays,0,index}', '1'::jsonb)
    )
  $test$,
    '23514',
    null,
    'rejects non-contiguous weekday indexes'
  );

select
  throws_ok (
    $test$
    insert into public.worlds (name, owner_id, calendar_config_json)
    values (
      'Invalid Month World',
      '51000000-0000-0000-0000-000000000001',
      jsonb_set(public.default_calendar_config(), '{months,0,dayCount}', '0'::jsonb)
    )
  $test$,
    '23514',
    null,
    'rejects month dayCount below one'
  );

select
  throws_ok (
    $test$
    insert into public.worlds (name, owner_id, calendar_config_json)
    values (
      'Invalid Start Month World',
      '51000000-0000-0000-0000-000000000001',
      jsonb_set(public.default_calendar_config(), '{startingMonthIndex}', '99'::jsonb)
    )
  $test$,
    '23514',
    null,
    'rejects startingMonthIndex that does not match an existing month'
  );

select
  throws_ok (
    $test$
    insert into public.worlds (name, owner_id, calendar_config_json)
    values (
      'Invalid Start Day World',
      '51000000-0000-0000-0000-000000000001',
      jsonb_set(public.default_calendar_config(), '{startingDayOfMonth}', '31'::jsonb)
    )
  $test$,
    '23514',
    null,
    'rejects startingDayOfMonth beyond selected month dayCount'
  );

select
  throws_ok (
    $test$
    insert into public.worlds (name, owner_id, calendar_config_json)
    values (
      'Invalid Template World',
      '51000000-0000-0000-0000-000000000001',
      jsonb_set(public.default_calendar_config(), '{dateFormatTemplate}', '"Year"'::jsonb)
    )
  $test$,
    '23514',
    null,
    'rejects date format templates missing a date token'
  );

select
  throws_ok (
    $test$
    insert into public.worlds (name, owner_id, calendar_config_json)
    values (
      'Invalid Template Token World',
      '51000000-0000-0000-0000-000000000001',
      jsonb_set(public.default_calendar_config(), '{dateFormatTemplate}', '"{month} {era}"'::jsonb)
    )
  $test$,
    '23514',
    null,
    'rejects unsupported date format template tokens'
  );

rollback;
