-- Migration: add_world_calendar_config
-- Adds the Epic 2 fantasy calendar configuration contract to worlds.
-- ---------------------------------------------------------------------------
-- Calendar config helpers
-- ---------------------------------------------------------------------------
create or replace function public.default_calendar_config () returns jsonb language sql immutable
set
  search_path = '' as $$
  select
    '{
      "weekdays": [
        { "index": 0, "name": "Moonday" },
        { "index": 1, "name": "Toilsday" },
        { "index": 2, "name": "Windsday" },
        { "index": 3, "name": "Thornsday" },
        { "index": 4, "name": "Fireday" },
        { "index": 5, "name": "Starday" },
        { "index": 6, "name": "Sunsday" }
      ],
      "months": [
        { "index": 0, "name": "Frostmonth", "dayCount": 30 },
        { "index": 1, "name": "Rainmonth", "dayCount": 30 },
        { "index": 2, "name": "Bloommonth", "dayCount": 30 },
        { "index": 3, "name": "Sunmonth", "dayCount": 30 },
        { "index": 4, "name": "Harvestmonth", "dayCount": 30 },
        { "index": 5, "name": "Darkmonth", "dayCount": 30 }
      ],
      "startingMonthIndex": 0,
      "startingDayOfMonth": 1,
      "startingYear": 1,
      "startingWeekdayOffset": 0,
      "yearFormatTemplate": "Year {n}"
    }'::jsonb;
$$;

create or replace function public.is_valid_calendar_config (config jsonb) returns boolean language plpgsql immutable
set
  search_path = '' as $$
declare
  months_length integer;
  selected_month_day_count integer;
  weekdays_length integer;
begin
  if config is null or jsonb_typeof(config) != 'object' then
    return false;
  end if;

  if
    not (
      config ?& array[
        'weekdays',
        'months',
        'startingMonthIndex',
        'startingDayOfMonth',
        'startingYear',
        'startingWeekdayOffset',
        'yearFormatTemplate'
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

  if weekdays_length < 1 then
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
  ) then
    return false;
  end if;

  if jsonb_typeof(config -> 'months') != 'array' then
    return false;
  end if;

  months_length := jsonb_array_length(config -> 'months');

  if months_length < 1 then
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
      or jsonb_typeof(month.value -> 'dayCount') != 'number'
      or (month.value ->> 'dayCount') !~ '^[1-9][0-9]*$'
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

  if
    jsonb_typeof(config -> 'startingWeekdayOffset') != 'number'
    or (config ->> 'startingWeekdayOffset') !~ '^(0|[1-9][0-9]*)$'
    or (config ->> 'startingWeekdayOffset')::numeric >= weekdays_length
  then
    return false;
  end if;

  if
    jsonb_typeof(config -> 'yearFormatTemplate') != 'string'
    or char_length(btrim(config ->> 'yearFormatTemplate')) < 1
    or position('{n}' in config ->> 'yearFormatTemplate') = 0
  then
    return false;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;

-- ---------------------------------------------------------------------------
-- worlds
-- ---------------------------------------------------------------------------
alter table public.worlds
add column calendar_config_json jsonb not null default public.default_calendar_config (),
add constraint worlds_calendar_config_json_check check (
  public.is_valid_calendar_config (calendar_config_json)
);
