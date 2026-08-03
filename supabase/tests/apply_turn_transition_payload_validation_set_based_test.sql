-- pgTAP tests for issue #1272: set-based cross-world guards and drift validation.
--
-- Verifies that apply_turn_transition still enforces the exact same error
-- contract (SQLSTATE + message text + first-offender ordering) on a LARGE
-- payload against a world with many citizens, and that neither the guards nor
-- the drift checks iterate row-by-row any more (structural assertions on the
-- function definitions — the old path built a v_valid_citizen_ids array of every
-- citizen in the world and rescanned it per payload element).
--
-- UUID prefix map (all c9-prefixed ranges, unique to this file):
--   c9100000 = users        c9200000 = worlds
--   c9300000 = transitions  c9400000 = nations
--   c9500000 = settlements  c9600000 = resources
--   c9700000 = citizens
begin;

select
  plan (7);

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
    'c9100000-0000-0000-0000-000000000001',
    'attpv-superadmin@example.com',
    'x',
    now(),
    '{"username":"attpv_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'c9100000-0000-0000-0000-000000000001';

-- World A (the target) and World B (the cross-world source).
insert into
  public.worlds (id, name, current_turn_number, status)
values
  (
    'c9200000-0000-0000-0000-000000000001',
    'ATTPV World A',
    5,
    'active'
  ),
  (
    'c9200000-0000-0000-0000-000000000002',
    'ATTPV World B',
    5,
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'c9400000-0000-0000-0000-000000000001',
    'c9200000-0000-0000-0000-000000000001',
    'ATTPV Nation A'
  ),
  (
    'c9400000-0000-0000-0000-000000000002',
    'c9200000-0000-0000-0000-000000000002',
    'ATTPV Nation B'
  );

-- 10 settlements in World A, 1 in World B.
insert into
  public.settlements (id, nation_id, name)
select
  (
    'c9500000-0000-0000-0000-' || lpad(i::text, 12, '0')
  )::uuid,
  'c9400000-0000-0000-0000-000000000001',
  'ATTPV Settlement ' || i
from
  generate_series(1, 10) as g (i);

insert into
  public.settlements (id, nation_id, name)
values
  (
    'c9500000-0000-0000-0000-000000000099',
    'c9400000-0000-0000-0000-000000000002',
    'ATTPV Settlement B'
  );

-- 20 resources in World A. Stockpile rows for every (settlement, resource) pair
-- are created by the resource INSERT seed trigger, so the payload below covers
-- 200 stockpile elements.
insert into
  public.resources (id, world_id, name, slug, base_stockpile_cap)
select
  (
    'c9600000-0000-0000-0000-' || lpad(i::text, 12, '0')
  )::uuid,
  'c9200000-0000-0000-0000-000000000001',
  'ATTPV Resource ' || i,
  'attpv-resource-' || i,
  100000
from
  generate_series(1, 20) as g (i);

-- 1000 citizens in World A — the scale that made the old id-array guard
-- expensive — plus one citizen in World B used as the cross-world attacker id.
insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status
  )
select
  (
    'c9700000-0000-0000-0000-' || lpad(i::text, 12, '0')
  )::uuid,
  'c9200000-0000-0000-0000-000000000001',
  'c9500000-0000-0000-0000-000000000001',
  'npc',
  'ATTPV Citizen ' || i,
  'alive'
from
  generate_series(1, 1000) as g (i);

insert into
  public.citizens (
    id,
    world_id,
    settlement_id,
    citizen_type,
    given_name,
    status
  )
values
  (
    'c9700000-0000-0000-0000-000000009999',
    'c9200000-0000-0000-0000-000000000002',
    'c9500000-0000-0000-0000-000000000099',
    'npc',
    'ATTPV Citizen B',
    'alive'
  );

-- A single running transition. Failed validations roll back (and leave the
-- transition 'running'), so all three calls below reuse it; the world stays on
-- turn 5 until the successful call at the end.
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
    'c9300000-0000-0000-0000-000000000001',
    'c9200000-0000-0000-0000-000000000001',
    5,
    6,
    'c9100000-0000-0000-0000-000000000001',
    'running'
  );

set
  local role service_role;

-- ===========================================================================
-- TEST 1: cross-world citizen id buried in a 1000-element assignmentClears
-- payload is still rejected, with the byte-identical message.
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'c9200000-0000-0000-0000-000000000001',
      5,
      jsonb_build_object(
        'assignmentClears',
        (
          select jsonb_agg(
            jsonb_build_object('citizenId', c.id)
            order by c.given_name
          )
          from (
            select id, given_name from public.citizens
            where world_id = 'c9200000-0000-0000-0000-000000000001'
            union all
            select 'c9700000-0000-0000-0000-000000009999'::uuid, 'ATTPV Citizen zz'
          ) c
        )
      ),
      'c9300000-0000-0000-0000-000000000001'::uuid
    )
    $test$,
    'P0001',
    'cross-world id c9700000-0000-0000-0000-000000009999 in assignmentClears',
    'large payload: foreign citizenId still rejected with the same message'
  );

-- ===========================================================================
-- TEST 2: with two drifted stockpile elements in a 200-element payload, the
-- earliest payload element is the one reported (check ordering preserved).
-- ===========================================================================
select
  throws_ok (
    $test$
    select public.apply_turn_transition(
      'c9200000-0000-0000-0000-000000000001',
      5,
      jsonb_build_object(
        'stockpileDeltas',
        (
          select jsonb_agg(
            jsonb_build_object(
              'settlementId',   sp.settlement_id,
              'resourceId',     sp.resource_id,
              'quantityBefore', case
                when sp.settlement_id in (
                  'c9500000-0000-0000-0000-000000000002',
                  'c9500000-0000-0000-0000-000000000005'
                ) and sp.resource_id = 'c9600000-0000-0000-0000-000000000002'
                then 5
                else sp.quantity
              end,
              'quantityAfter',  sp.quantity + 10,
              'produced',       10,
              'consumed',       0,
              'tradeIn',        0,
              'tradeOut',       0
            )
            order by sp.settlement_id, sp.resource_id
          )
          from public.settlement_resource_stockpiles sp
          join public.settlements st on st.id = sp.settlement_id
          where st.nation_id = 'c9400000-0000-0000-0000-000000000001'
        )
      ),
      'c9300000-0000-0000-0000-000000000001'::uuid
    )
    $test$,
    'P0001',
    'state diverged: stockpile (c9500000-0000-0000-0000-000000000002,c9600000-0000-0000-0000-000000000002) was 0.0000 but payload claimed 5.0000',
    'large payload: first drifted stockpile element in payload order is reported'
  );

-- ===========================================================================
-- TEST 3: the same large payload with honest before-values applies cleanly.
-- ===========================================================================
select
  lives_ok (
    $test$
    select public.apply_turn_transition(
      'c9200000-0000-0000-0000-000000000001',
      5,
      jsonb_build_object(
        'stockpileDeltas',
        (
          select jsonb_agg(
            jsonb_build_object(
              'settlementId',   sp.settlement_id,
              'resourceId',     sp.resource_id,
              'quantityBefore', sp.quantity,
              'quantityAfter',  sp.quantity + 10,
              'produced',       10,
              'consumed',       0,
              'tradeIn',        0,
              'tradeOut',       0
            )
            order by sp.settlement_id, sp.resource_id
          )
          from public.settlement_resource_stockpiles sp
          join public.settlements st on st.id = sp.settlement_id
          where st.nation_id = 'c9400000-0000-0000-0000-000000000001'
        ),
        'assignmentClears',
        (
          select jsonb_agg(jsonb_build_object('citizenId', c.id))
          from public.citizens c
          where c.world_id = 'c9200000-0000-0000-0000-000000000001'
        )
      ),
      'c9300000-0000-0000-0000-000000000001'::uuid
    )
    $test$,
    'large payload: 200 stockpile deltas + 1000 assignment clears validate and apply'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_resource_stockpiles sp
        join public.settlements st on st.id = sp.settlement_id
      where
        st.nation_id = 'c9400000-0000-0000-0000-000000000001'
        and sp.quantity = 10::numeric(18, 4)
    ),
    200,
    'large payload: every stockpile advanced after validation passed'
  );

reset role;

-- ===========================================================================
-- TEST 5-7: structural — validation no longer iterates the payload row-by-row
-- and no longer materialises world-wide id arrays.
-- ===========================================================================
select
  ok (
    pg_get_functiondef(
      'public.internal_apply_turn_transition_validate_payload(uuid,jsonb)'::regprocedure
    ) not like '%end loop%',
    'payload validation helper is set-based: no per-element loop'
  );

select
  ok (
    pg_get_functiondef(
      'public.apply_turn_transition(uuid,integer,jsonb,uuid,jsonb)'::regprocedure
    ) not like '%v_valid_citizen_ids%',
    'orchestrator no longer materialises a world-wide citizen id array'
  );

select
  ok (
    pg_get_functiondef(
      'public.apply_turn_transition(uuid,integer,jsonb,uuid,jsonb)'::regprocedure
    ) like '%internal_apply_turn_transition_validate_payload%',
    'orchestrator delegates guards and drift checks to the set-based helper'
  );

rollback;
