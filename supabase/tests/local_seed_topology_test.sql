-- pgTAP tests for local Epic 2 seed topology.
-- Run with: npx supabase test db
begin;

select
  plan (12);

select
  ok (
    exists (
      select
        1
      from
        public.worlds
      where
        id = '00000000-0000-0000-0000-000000000101'
        and public.is_valid_calendar_config (calendar_config_json)
    ),
    'local seed includes a valid world calendar config'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.nations
      where
        id = '00000000-0000-0000-0000-000000000201'
        and world_id = '00000000-0000-0000-0000-000000000101'
    ),
    1,
    'local seed includes a nation for the local development world'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlements
      where
        nation_id = '00000000-0000-0000-0000-000000000201'
    ),
    3,
    'local seed includes settlements under the seeded nation'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlements
      where
        nation_id = '00000000-0000-0000-0000-000000000201'
        and auto_ready_enabled = false
        and is_ready_current_turn = true
    ),
    1,
    'local seed includes a manually ready settlement'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlements
      where
        nation_id = '00000000-0000-0000-0000-000000000201'
        and auto_ready_enabled = false
        and is_ready_current_turn = false
    ),
    1,
    'local seed includes a not-ready settlement'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlements
      where
        nation_id = '00000000-0000-0000-0000-000000000201'
        and auto_ready_enabled = true
        and is_ready_current_turn = false
    ),
    1,
    'local seed includes an auto-ready settlement'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlements
      where
        nation_id = '00000000-0000-0000-0000-000000000201'
        and (
          auto_ready_enabled
          or is_ready_current_turn
        )
    ),
    2,
    'local seed supports readiness summary ready counts'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlements
      where
        nation_id = '00000000-0000-0000-0000-000000000201'
        and not (
          auto_ready_enabled
          or is_ready_current_turn
        )
    ),
    1,
    'local seed supports readiness summary not-ready counts'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  is (
    (
      select
        count(*)::integer
      from
        public.advance_world_turn_if_current ('00000000-0000-0000-0000-000000000101', 0)
    ),
    1,
    'local seeded world can be advanced by its admin'
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
        id = '00000000-0000-0000-0000-000000000101'
    ),
    1,
    'local seeded world advances exactly one turn'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlements
      where
        nation_id = '00000000-0000-0000-0000-000000000201'
        and auto_ready_enabled = false
        and is_ready_current_turn = false
        and ready_set_at is null
    ),
    2,
    'end-turn reset clears manual readiness for seeded settlements'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlements
      where
        nation_id = '00000000-0000-0000-0000-000000000201'
        and auto_ready_enabled = true
        and is_ready_current_turn = true
        and ready_set_at is null
    ),
    1,
    'end-turn reset reapplies auto-readiness for seeded settlements'
  );

select
  *
from
  finish ();

rollback;
