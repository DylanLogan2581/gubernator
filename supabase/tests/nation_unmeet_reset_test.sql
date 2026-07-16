-- pgTAP tests for #1259: set_nations_unmet resets relationship and treaty
-- state for the un-met pair instead of leaving stale rows behind for a
-- later re-meet to resurrect.
--
-- Covers:
--   • Both directional nation_relationships rows for the pair (including a
--     pending bilateral proposal) are deleted.
--   • A live (proposed / active) nation_treaties row for the pair is force-
--     terminated to 'broken'.
--   • An already-terminal treaty (declined) for the pair is left untouched.
--   • Relationship and treaty rows for an unrelated pair sharing one of the
--     two nations are untouched.
--   • Re-meeting the pair afterwards starts from a blank slate (no
--     relationship rows).
-- Run with: npx supabase test db
--
-- UUID range (all hex, unique to this file): ff000000
begin;

select
  plan (9);

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
    'ff000000-0000-0000-0000-000000000001',
    'unmeet-admin@example.com',
    'x',
    now(),
    '{"username":"unmeet_admin"}'::jsonb,
    now(),
    now()
  );

insert into
  public.worlds (id, name, status, current_turn_number)
values
  (
    'ff000000-0000-0000-0000-000000000010',
    'Unmeet World',
    'active',
    9
  );

insert into
  public.world_admins (world_id, user_id)
values
  (
    'ff000000-0000-0000-0000-000000000010',
    'ff000000-0000-0000-0000-000000000001'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'ff000000-0000-0000-0000-0000000000a1',
    'ff000000-0000-0000-0000-000000000010',
    'Unmeet Nation A'
  ),
  (
    'ff000000-0000-0000-0000-0000000000b1',
    'ff000000-0000-0000-0000-000000000010',
    'Unmeet Nation B'
  ),
  (
    'ff000000-0000-0000-0000-0000000000c1',
    'ff000000-0000-0000-0000-000000000010',
    'Unmeet Nation C'
  );

insert into
  public.nation_discoveries (
    id,
    world_id,
    nation_a_id,
    nation_b_id,
    met_at_turn_number
  )
values
  (
    'ff000000-0000-0000-0000-0000000000d1',
    'ff000000-0000-0000-0000-000000000010',
    'ff000000-0000-0000-0000-0000000000a1',
    'ff000000-0000-0000-0000-0000000000b1',
    1
  ),
  (
    'ff000000-0000-0000-0000-0000000000d2',
    'ff000000-0000-0000-0000-000000000010',
    'ff000000-0000-0000-0000-0000000000a1',
    'ff000000-0000-0000-0000-0000000000c1',
    1
  );

-- A/B relationship: hostile with a mirrored reciprocal row, plus a pending
-- non_aggression_pact proposal on the A->B row.
insert into
  public.nation_relationships (
    from_nation_id,
    to_nation_id,
    current_stance,
    pending_stance,
    pending_status
  )
values
  (
    'ff000000-0000-0000-0000-0000000000a1',
    'ff000000-0000-0000-0000-0000000000b1',
    'hostile',
    'non_aggression_pact',
    'proposed'
  ),
  (
    'ff000000-0000-0000-0000-0000000000b1',
    'ff000000-0000-0000-0000-0000000000a1',
    'hostile',
    null,
    null
  );

-- A/C relationship: unrelated pair sharing nation A, must survive the A/B
-- unmeet untouched.
insert into
  public.nation_relationships (from_nation_id, to_nation_id, current_stance)
values
  (
    'ff000000-0000-0000-0000-0000000000a1',
    'ff000000-0000-0000-0000-0000000000c1',
    'friendly'
  );

-- A/B treaties: one active, one already declined (terminal, must not flip to
-- broken).
insert into
  public.nation_treaties (
    id,
    world_id,
    proposer_nation_id,
    responder_nation_id,
    treaty_type,
    terms,
    status,
    starts_turn_number
  )
values
  (
    'ff000000-0000-0000-0000-0000000000e1',
    'ff000000-0000-0000-0000-000000000010',
    'ff000000-0000-0000-0000-0000000000a1',
    'ff000000-0000-0000-0000-0000000000b1',
    'trade_agreement',
    '{}'::jsonb,
    'active',
    1
  ),
  (
    'ff000000-0000-0000-0000-0000000000e2',
    'ff000000-0000-0000-0000-000000000010',
    'ff000000-0000-0000-0000-0000000000b1',
    'ff000000-0000-0000-0000-0000000000a1',
    'trade_agreement',
    '{}'::jsonb,
    'declined',
    null
  );

-- ===========================================================================
-- set_nations_unmet resets the A/B pair.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ff000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.set_nations_unmet(
      'ff000000-0000-0000-0000-0000000000a1',
      'ff000000-0000-0000-0000-0000000000b1'
    )
  $test$,
    'world admin can call set_nations_unmet on the A/B pair'
  );

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_relationships
      where
        (
          from_nation_id = 'ff000000-0000-0000-0000-0000000000a1'
          and to_nation_id = 'ff000000-0000-0000-0000-0000000000b1'
        )
        or (
          from_nation_id = 'ff000000-0000-0000-0000-0000000000b1'
          and to_nation_id = 'ff000000-0000-0000-0000-0000000000a1'
        )
    ),
    0,
    'both directional A/B nation_relationships rows, including the pending proposal, are deleted'
  );

select
  is (
    (
      select
        current_stance::text
      from
        public.nation_relationships
      where
        from_nation_id = 'ff000000-0000-0000-0000-0000000000a1'
        and to_nation_id = 'ff000000-0000-0000-0000-0000000000c1'
    ),
    'friendly',
    'the unrelated A/C relationship row is untouched'
  );

select
  is (
    (
      select
        status
      from
        public.nation_treaties
      where
        id = 'ff000000-0000-0000-0000-0000000000e1'
    ),
    'broken',
    'the active A/B treaty is force-terminated to broken'
  );

select
  is (
    (
      select
        status
      from
        public.nation_treaties
      where
        id = 'ff000000-0000-0000-0000-0000000000e2'
    ),
    'declined',
    'an already-terminal A/B treaty is left untouched'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_discoveries
      where
        nation_a_id = 'ff000000-0000-0000-0000-0000000000a1'
        and nation_b_id = 'ff000000-0000-0000-0000-0000000000b1'
    ),
    0,
    'the A/B discovery row is removed'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_discoveries
      where
        nation_a_id = 'ff000000-0000-0000-0000-0000000000a1'
        and nation_b_id = 'ff000000-0000-0000-0000-0000000000c1'
    ),
    1,
    'the unrelated A/C discovery row is untouched'
  );

-- ===========================================================================
-- Re-meeting starts from a blank slate: no relationship rows resurrected.
-- ===========================================================================
set
  local role authenticated;

set
  local "request.jwt.claims" = '{"sub":"ff000000-0000-0000-0000-000000000001","role":"authenticated"}';

select
  lives_ok (
    $test$
    select public.set_nations_met(
      'ff000000-0000-0000-0000-0000000000a1',
      'ff000000-0000-0000-0000-0000000000b1'
    )
  $test$,
    'world admin can re-meet the A/B pair'
  );

reset role;

select
  is (
    (
      select
        count(*)::integer
      from
        public.nation_relationships
      where
        (
          from_nation_id = 'ff000000-0000-0000-0000-0000000000a1'
          and to_nation_id = 'ff000000-0000-0000-0000-0000000000b1'
        )
        or (
          from_nation_id = 'ff000000-0000-0000-0000-0000000000b1'
          and to_nation_id = 'ff000000-0000-0000-0000-0000000000a1'
        )
    ),
    0,
    're-meeting the pair does not resurrect the old relationship rows'
  );

select
  *
from
  finish ();

rollback;
