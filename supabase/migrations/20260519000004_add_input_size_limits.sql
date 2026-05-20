-- Migration: add_input_size_limits
-- Enforces practical maximum sizes on user-controlled text, JSON, and
-- calendar-configuration fields at the database boundary so direct Supabase
-- callers cannot bypass UI limits and submit oversized values. Limits mirror
-- the constants in `src/lib/inputLimits.ts`; keep them in sync.
-- ---------------------------------------------------------------------------
-- Text length caps
-- ---------------------------------------------------------------------------
alter table public.worlds
add constraint worlds_name_max_length_check check (char_length(name) <= 64);

alter table public.nations
add constraint nations_name_max_length_check check (char_length(name) <= 64),
add constraint nations_description_max_length_check check (
  description is null
  or char_length(description) <= 1000
);

alter table public.settlements
add constraint settlements_name_max_length_check check (char_length(name) <= 64),
add constraint settlements_description_max_length_check check (
  description is null
  or char_length(description) <= 1000
);

alter table public.notifications
add constraint notifications_notification_type_max_length_check check (char_length(notification_type) <= 32),
add constraint notifications_message_text_max_length_check check (char_length(message_text) <= 500);

-- ---------------------------------------------------------------------------
-- Turn log payload size cap (raw stored bytes, including jsonb overhead)
-- ---------------------------------------------------------------------------
alter table public.turn_log_entries
add constraint turn_log_entries_payload_jsonb_size_check check (pg_column_size(payload_jsonb) <= 32768),
add constraint turn_log_entries_log_category_max_length_check check (char_length(log_category) <= 64);

-- ---------------------------------------------------------------------------
-- Calendar config bounds
-- ---------------------------------------------------------------------------
-- Replaces the existing validator with one that also enforces maximum counts,
-- maximum item-name lengths, a maximum month dayCount, a maximum template
-- length, and a bounded startingYear range. Shape and minimum rules are
-- preserved unchanged.
create or replace function public.is_valid_calendar_config (config jsonb) returns boolean language plpgsql immutable
set
  search_path = '' as $$
declare
  months_length integer;
  selected_month_day_count integer;
  weekdays_length integer;
  starting_year numeric;
begin
  if config is null or jsonb_typeof(config) != 'object' then
    return false;
  end if;

  if
    not (
      config ?& array[
        'dateFormatTemplate',
        'weekdays',
        'months',
        'startingMonthIndex',
        'startingDayOfMonth',
        'startingYear',
        'startingWeekdayOffset'
      ]
      and (
        select
          count(*) = 7
        from
          jsonb_object_keys(config)
      )
    )
  then
    return false;
  end if;

  if jsonb_typeof(config -> 'weekdays') != 'array' then
    return false;
  end if;

  weekdays_length := jsonb_array_length(config -> 'weekdays');

  if weekdays_length < 1 or weekdays_length > 32 then
    return false;
  end if;

  if exists (
    select
      1
    from
      jsonb_array_elements(config -> 'weekdays') with ordinality as weekday (value, ordinal)
    where
      jsonb_typeof(weekday.value) != 'object'
      or not (
        weekday.value ?& array['index', 'name']
        and (
          select
            count(*) = 2
          from
            jsonb_object_keys(weekday.value)
        )
      )
      or jsonb_typeof(weekday.value -> 'index') != 'number'
      or (weekday.value ->> 'index') !~ '^(0|[1-9][0-9]*)$'
      or (weekday.value ->> 'index')::numeric != weekday.ordinal - 1
      or jsonb_typeof(weekday.value -> 'name') != 'string'
      or char_length(btrim(weekday.value ->> 'name')) < 1
      or char_length(weekday.value ->> 'name') > 64
  ) then
    return false;
  end if;

  if jsonb_typeof(config -> 'months') != 'array' then
    return false;
  end if;

  months_length := jsonb_array_length(config -> 'months');

  if months_length < 1 or months_length > 32 then
    return false;
  end if;

  if exists (
    select
      1
    from
      jsonb_array_elements(config -> 'months') with ordinality as month (value, ordinal)
    where
      jsonb_typeof(month.value) != 'object'
      or not (
        month.value ?& array['index', 'name', 'dayCount']
        and (
          select
            count(*) = 3
          from
            jsonb_object_keys(month.value)
        )
      )
      or jsonb_typeof(month.value -> 'index') != 'number'
      or (month.value ->> 'index') !~ '^(0|[1-9][0-9]*)$'
      or (month.value ->> 'index')::numeric != month.ordinal - 1
      or jsonb_typeof(month.value -> 'name') != 'string'
      or char_length(btrim(month.value ->> 'name')) < 1
      or char_length(month.value ->> 'name') > 64
      or jsonb_typeof(month.value -> 'dayCount') != 'number'
      or (month.value ->> 'dayCount') !~ '^[1-9][0-9]*$'
      or (month.value ->> 'dayCount')::numeric > 1000
  ) then
    return false;
  end if;

  if
    jsonb_typeof(config -> 'startingMonthIndex') != 'number'
    or (config ->> 'startingMonthIndex') !~ '^(0|[1-9][0-9]*)$'
  then
    return false;
  end if;

  select
    (month.value ->> 'dayCount')::integer
  into selected_month_day_count
  from
    jsonb_array_elements(config -> 'months') as month (value)
  where
    (month.value ->> 'index')::numeric = (config ->> 'startingMonthIndex')::numeric;

  if selected_month_day_count is null then
    return false;
  end if;

  if
    jsonb_typeof(config -> 'startingDayOfMonth') != 'number'
    or (config ->> 'startingDayOfMonth') !~ '^[1-9][0-9]*$'
    or (config ->> 'startingDayOfMonth')::numeric > selected_month_day_count
  then
    return false;
  end if;

  if
    jsonb_typeof(config -> 'startingYear') != 'number'
    or (config ->> 'startingYear') !~ '^-?(0|[1-9][0-9]*)$'
  then
    return false;
  end if;

  starting_year := (config ->> 'startingYear')::numeric;

  if starting_year < -1000000 or starting_year > 1000000 then
    return false;
  end if;

  if
    jsonb_typeof(config -> 'startingWeekdayOffset') != 'number'
    or (config ->> 'startingWeekdayOffset') !~ '^(0|[1-9][0-9]*)$'
    or (config ->> 'startingWeekdayOffset')::numeric >= weekdays_length
  then
    return false;
  end if;

  if
    jsonb_typeof(config -> 'dateFormatTemplate') != 'string'
    or char_length(btrim(config ->> 'dateFormatTemplate')) < 1
    or char_length(config ->> 'dateFormatTemplate') > 200
    or (config ->> 'dateFormatTemplate') !~ '\{(weekday|month|day|year)\}'
    or exists (
      select
        1
      from
        regexp_matches(config ->> 'dateFormatTemplate', '\{[^{}]+\}', 'g') as token (value)
      where
        token.value[1] not in ('{weekday}', '{month}', '{day}', '{year}')
    )
  then
    return false;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;
