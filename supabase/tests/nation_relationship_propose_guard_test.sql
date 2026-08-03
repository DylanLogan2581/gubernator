-- pgTAP tests for the nation_relationships_guard_propose trigger (issue #954).
-- Run with: npx supabase test db
--
-- Covers:
--   • A fresh propose (upsert, matching the client's INSERT ... ON CONFLICT DO
--     UPDATE shape) sets pending_changed_by_citizen_id to the acting nation
--     manager's citizen id.
--   • A later propose by a different nation manager updates
--     pending_changed_by_citizen_id — the previous (now-retired) manager's id
--     does not linger as a stale actor.
--   • Proposing over an already-accepted relationship is rejected server-side
--     with P0001, in the same statement as the upsert (closes the TOCTOU
--     window a client-side pre-check-then-upsert would leave open).
--   • A rejected propose leaves the accepted row untouched.
--
-- UUID ranges (all numeric/hex, unique to this file):
--   f7000000 = users        f7100000 = worlds
--   f7200000 = nations      f7300000 = settlements
--   f7400000 = citizens
begin;

select
  plan (5);

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
    'f7000000-0000-0000-0000-000000000001',
    'propose-guard-mgr-a1@example.com',
    'x',
    now(),
    '{"username":"propose_guard_mgr_a1"}'::jsonb,
    now(),
    now()
  ),
  (
    'f7000000-0000-0000-0000-000000000002',
    'propose-guard-mgr-a2@example.com',
    'x',
    now(),
    '{"username":"propose_guard_mgr_a2"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status)
values
  (
    'f7100000-0000-0000-0000-000000000001',
    'Propose Guard World',
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'f7200000-0000-0000-0000-00000000000a',
    'f7100000-0000-0000-0000-000000000001',
    'Nation A'
  ),
  (
    'f7200000-0000-0000-0000-00000000000b',
    'f7100000-0000-0000-0000-000000000001',
    'Nation B'
  );

-- guard_bilateral_relationship_propose (#1086) rejects a fresh propose
-- (pending_status = 'proposed') between nations that have not met.
insert into
  public.nation_discoveries (
    world_id,
    nation_a_id,
    nation_b_id,
    met_at_turn_number
  )
values
  (
    'f7100000-0000-0000-0000-000000000001',
    'f7200000-0000-0000-0000-00000000000a',
    'f7200000-0000-0000-0000-00000000000b',
    1
  );

insert into
  public.settlements (id, nation_id, name)
values
  (
    'f7300000-0000-0000-0000-0000000000a1',
    'f7200000-0000-0000-0000-00000000000a',
    'Settlement A1'
  );

-- citizen1: Nation A's first manager. Proposes first, then retires.
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
    'f7400000-0000-0000-0000-0000000000a1',
    'f7100000-0000-0000-0000-000000000001',
    'f7300000-0000-0000-0000-0000000000a1',
    'player_character',
    'Nation A Manager 1',
    'alive',
    'f7000000-0000-0000-0000-000000000001',
    'nation_manager',
    'f7200000-0000-0000-0000-00000000000a'
  );

-- nation_visible_to_current_user's have-met arm (#1086) resolves the caller's
-- own nation via their ACTIVE player_character, so citizen1 needs an active
-- selection for nation_relationships_select_visible (both from/to visible) to
-- admit the propose upsert's implicit ON CONFLICT SELECT check.
insert into
  public.user_active_player_characters (user_id, world_id, citizen_id)
values
  (
    'f7000000-0000-0000-0000-000000000001',
    'f7100000-0000-0000-0000-000000000001',
    'f7400000-0000-0000-0000-0000000000a1'
  );

-- ===========================================================================
-- A fresh propose sets pending_changed_by_citizen_id to the acting citizen.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f7000000-0000-0000-0000-000000000001","role":"authenticated"}';

insert into
  public.nation_relationships (
    from_nation_id,
    to_nation_id,
    pending_stance,
    pending_status,
    world_id
  )
values
  (
    'f7200000-0000-0000-0000-00000000000a',
    'f7200000-0000-0000-0000-00000000000b',
    'allied',
    'proposed',
    'f7100000-0000-0000-0000-000000000001'
  )
on conflict (from_nation_id, to_nation_id) do update
set
  pending_stance = excluded.pending_stance,
  pending_status = excluded.pending_status;

reset role;

select
  is (
    (
      select
        pending_changed_by_citizen_id
      from
        public.nation_relationships
      where
        from_nation_id = 'f7200000-0000-0000-0000-00000000000a'
        and to_nation_id = 'f7200000-0000-0000-0000-00000000000b'
    ),
    'f7400000-0000-0000-0000-0000000000a1'::uuid,
    'propose sets pending_changed_by_citizen_id to the acting nation manager'
  );

-- ===========================================================================
-- Citizen 1 retires; citizen 2 takes over as Nation A's manager and
-- re-proposes. pending_changed_by_citizen_id must update to citizen 2 — not
-- linger on the retired citizen 1 (the bug this trigger fixes).
-- ===========================================================================
update public.citizens
set
  status = 'dead',
  death_cause_category = 'manual_admin'
where
  id = 'f7400000-0000-0000-0000-0000000000a1';

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
    'f7400000-0000-0000-0000-0000000000a2',
    'f7100000-0000-0000-0000-000000000001',
    'f7300000-0000-0000-0000-0000000000a1',
    'player_character',
    'Nation A Manager 2',
    'alive',
    'f7000000-0000-0000-0000-000000000002',
    'nation_manager',
    'f7200000-0000-0000-0000-00000000000a'
  );

insert into
  public.user_active_player_characters (user_id, world_id, citizen_id)
values
  (
    'f7000000-0000-0000-0000-000000000002',
    'f7100000-0000-0000-0000-000000000001',
    'f7400000-0000-0000-0000-0000000000a2'
  );

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f7000000-0000-0000-0000-000000000002","role":"authenticated"}';

insert into
  public.nation_relationships (
    from_nation_id,
    to_nation_id,
    pending_stance,
    pending_status,
    world_id
  )
values
  (
    'f7200000-0000-0000-0000-00000000000a',
    'f7200000-0000-0000-0000-00000000000b',
    'non_aggression_pact',
    'proposed',
    'f7100000-0000-0000-0000-000000000001'
  )
on conflict (from_nation_id, to_nation_id) do update
set
  pending_stance = excluded.pending_stance,
  pending_status = excluded.pending_status;

reset role;

select
  is (
    (
      select
        pending_changed_by_citizen_id
      from
        public.nation_relationships
      where
        from_nation_id = 'f7200000-0000-0000-0000-00000000000a'
        and to_nation_id = 'f7200000-0000-0000-0000-00000000000b'
    ),
    'f7400000-0000-0000-0000-0000000000a2'::uuid,
    're-propose by a new manager updates pending_changed_by_citizen_id, not the retired manager'
  );

-- ===========================================================================
-- Move the relationship to accepted (table owner, bypasses RLS), then attempt
-- to propose over it. The guard trigger must reject with P0001 in the same
-- statement as the upsert.
-- ===========================================================================
update public.nation_relationships
set
  current_stance = 'non_aggression_pact',
  pending_stance = null,
  pending_status = 'accepted'
where
  from_nation_id = 'f7200000-0000-0000-0000-00000000000a'
  and to_nation_id = 'f7200000-0000-0000-0000-00000000000b';

set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"f7000000-0000-0000-0000-000000000002","role":"authenticated"}';

select
  throws_ok (
    $test$
    insert into public.nation_relationships (
      from_nation_id, to_nation_id, pending_stance, pending_status, world_id
    ) values (
      'f7200000-0000-0000-0000-00000000000a',
      'f7200000-0000-0000-0000-00000000000b',
      'allied',
      'proposed',
      'f7100000-0000-0000-0000-000000000001'
    )
    on conflict (from_nation_id, to_nation_id) do update
    set pending_stance = excluded.pending_stance,
        pending_status = excluded.pending_status
    $test$,
    'P0001',
    null,
    'proposing over an accepted relationship is rejected with P0001'
  );

reset role;

select
  is (
    (
      select
        pending_status
      from
        public.nation_relationships
      where
        from_nation_id = 'f7200000-0000-0000-0000-00000000000a'
        and to_nation_id = 'f7200000-0000-0000-0000-00000000000b'
    ),
    'accepted',
    'rejected propose leaves pending_status = accepted'
  );

select
  is (
    (
      select
        current_stance
      from
        public.nation_relationships
      where
        from_nation_id = 'f7200000-0000-0000-0000-00000000000a'
        and to_nation_id = 'f7200000-0000-0000-0000-00000000000b'
    ),
    'non_aggression_pact',
    'rejected propose leaves current_stance untouched'
  );

select
  *
from
  finish ();

rollback;
