-- pgTAP tests for public.resources.change_mode / change_amount (issue #1165):
-- generalizes the old percent-only decay_rate into a signed change_amount +
-- change_mode (percent|flat), so a resource can grow or decay by a flat
-- quantity or a percentage each turn.
-- Run with: npx supabase test db
begin;

select
  plan (7);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into
  public.worlds (id, name, visibility)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'Change Mode Test World',
    'private'
  );

-- ---------------------------------------------------------------------------
-- 1. decay_rate column is gone
-- ---------------------------------------------------------------------------
select
  is_empty (
    $$
    select column_name from information_schema.columns
    where table_schema = 'public' and table_name = 'resources' and column_name = 'decay_rate'
    $$,
    'decay_rate column has been dropped from public.resources'
  );

-- ---------------------------------------------------------------------------
-- 2. Default change_mode/change_amount on insert
-- ---------------------------------------------------------------------------
insert into
  public.resources (world_id, name, slug)
values
  (
    'c2000000-0000-0000-0000-000000000001',
    'Default Resource',
    'default-resource'
  );

select
  results_eq (
    $$
    select change_mode, change_amount from public.resources
    where world_id = 'c2000000-0000-0000-0000-000000000001' and slug = 'default-resource'
    $$,
    $$values ('percent'::text, 0.00::numeric)$$,
    'change_mode defaults to percent and change_amount defaults to 0'
  );

-- ---------------------------------------------------------------------------
-- 3. Percent decay capped at -100 (cannot lose more than 100% per turn)
-- ---------------------------------------------------------------------------
select
  throws_ok (
    $$
    insert into public.resources (world_id, name, slug, change_mode, change_amount)
    values ('c2000000-0000-0000-0000-000000000001', 'Over Decay', 'over-decay', 'percent', -100.01)
    $$,
    '23514',
    null,
    'percent change_amount below -100 is rejected'
  );

select
  lives_ok (
    $$
    insert into public.resources (world_id, name, slug, change_mode, change_amount)
    values ('c2000000-0000-0000-0000-000000000001', 'Full Decay', 'full-decay', 'percent', -100)
    $$,
    'percent change_amount of exactly -100 is accepted'
  );

-- ---------------------------------------------------------------------------
-- 4. Percent growth is unbounded above (no schema-level cap)
-- ---------------------------------------------------------------------------
select
  lives_ok (
    $$
    insert into public.resources (world_id, name, slug, change_mode, change_amount)
    values ('c2000000-0000-0000-0000-000000000001', 'Big Growth', 'big-growth', 'percent', 500)
    $$,
    'percent change_amount above 100 (growth) is accepted'
  );

-- ---------------------------------------------------------------------------
-- 5. Flat mode is not subject to the percent range check
-- ---------------------------------------------------------------------------
select
  lives_ok (
    $$
    insert into public.resources (world_id, name, slug, change_mode, change_amount)
    values ('c2000000-0000-0000-0000-000000000001', 'Flat Loss', 'flat-loss', 'flat', -5000)
    $$,
    'flat change_amount below -100 is accepted (percent range check does not apply)'
  );

-- ---------------------------------------------------------------------------
-- 6. change_mode is constrained to percent|flat
-- ---------------------------------------------------------------------------
select
  throws_ok (
    $$
    insert into public.resources (world_id, name, slug, change_mode, change_amount)
    values ('c2000000-0000-0000-0000-000000000001', 'Bad Mode', 'bad-mode', 'exponential', 0)
    $$,
    '23514',
    null,
    'change_mode outside percent|flat is rejected'
  );

select
  *
from
  finish ();

rollback;
