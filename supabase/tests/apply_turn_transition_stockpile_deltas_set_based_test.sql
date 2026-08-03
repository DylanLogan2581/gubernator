-- pgTAP tests for issue #1270: set-based stockpile delta write path.
--
-- Verifies that internal_apply_turn_transition_stockpile_deltas produces the
-- same results on a LARGE multi-settlement / multi-resource payload as the old
-- row-by-row loop did, and that its statement count no longer scales with the
-- element count (structural assertion on the function definition).
--
-- UUID prefix map (all b7-prefixed ranges, unique to this file):
--   b7100000 = users        b7200000 = worlds
--   b7300000 = transitions  b7400000 = nations
--   b7500000 = settlements  b7600000 = resources
begin;

select
  plan (8);

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
    'b7100000-0000-0000-0000-000000000001',
    'attsb-superadmin@example.com',
    'x',
    now(),
    '{"username":"attsb_superadmin"}'::jsonb,
    now(),
    now()
  );

update public.users
set
  is_super_admin = true
where
  id = 'b7100000-0000-0000-0000-000000000001';

insert into
  public.worlds (id, name, current_turn_number, status)
values
  (
    'b7200000-0000-0000-0000-000000000001',
    'ATTSB Large Payload World',
    5,
    'active'
  );

insert into
  public.nations (id, world_id, name)
values
  (
    'b7400000-0000-0000-0000-000000000001',
    'b7200000-0000-0000-0000-000000000001',
    'ATTSB Nation'
  );

-- 10 settlements
insert into
  public.settlements (id, nation_id, name)
select
  (
    'b7500000-0000-0000-0000-' || lpad(i::text, 12, '0')
  )::uuid,
  'b7400000-0000-0000-0000-000000000001',
  'ATTSB Settlement ' || i
from
  generate_series(1, 10) as g (i);

-- 20 resources — resource 1 has a deliberately low cap to exercise clamping.
-- Stockpile rows for every (settlement, resource) pair are created by the
-- resource INSERT seed trigger, so the payload below covers 200 elements.
insert into
  public.resources (id, world_id, name, slug, base_stockpile_cap)
select
  (
    'b7600000-0000-0000-0000-' || lpad(i::text, 12, '0')
  )::uuid,
  'b7200000-0000-0000-0000-000000000001',
  'ATTSB Resource ' || i,
  'attsb-resource-' || i,
  case
    when i = 1 then 100
    else 100000
  end
from
  generate_series(1, 20) as g (i);

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
    'b7300000-0000-0000-0000-000000000001',
    'b7200000-0000-0000-0000-000000000001',
    5,
    6,
    'b7100000-0000-0000-0000-000000000001',
    'running'
  );

-- Prior-turn snapshot for settlement 2 / resource 2, plus a live stockpile value
-- that differs from it — exercises adjustment_amount on the set-based path.
insert into
  public.settlement_turn_resource_snapshots (
    world_id,
    settlement_id,
    resource_id,
    turn_number,
    quantity_before,
    quantity_after
  )
values
  (
    'b7200000-0000-0000-0000-000000000001',
    'b7500000-0000-0000-0000-000000000002',
    'b7600000-0000-0000-0000-000000000002',
    4,
    0,
    5
  );

update public.settlement_resource_stockpiles
set
  quantity = 7
where
  settlement_id = 'b7500000-0000-0000-0000-000000000002'
  and resource_id = 'b7600000-0000-0000-0000-000000000002';

-- ===========================================================================
-- All tests run as service_role
-- ===========================================================================
set
  local role service_role;

-- 200-element payload. quantityBefore mirrors the live stockpile value so the
-- drift guard passes; quantityAfter for resource 1 exceeds its cap (clamp).
select
  public.apply_turn_transition (
    'b7200000-0000-0000-0000-000000000001',
    5,
    jsonb_build_object(
      'stockpileDeltas',
      (
        select
          jsonb_agg(
            jsonb_build_object(
              'settlementId',
              st.id,
              'resourceId',
              r.id,
              'quantityBefore',
              sp.quantity,
              'quantityAfter',
              sp.quantity + 200,
              'produced',
              200,
              'consumed',
              0,
              'tradeIn',
              0,
              'tradeOut',
              0
            )
          )
        from
          public.settlement_resource_stockpiles sp
          join public.settlements st on st.id = sp.settlement_id
          join public.resources r on r.id = sp.resource_id
        where
          st.nation_id = 'b7400000-0000-0000-0000-000000000001'
          and r.slug like 'attsb-resource-%'
      )
    ),
    'b7300000-0000-0000-0000-000000000001'::uuid
  );

-- ===========================================================================
-- TEST 1-2: every element produced a snapshot row and a stockpile update
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_turn_resource_snapshots s
        join public.resources r on r.id = s.resource_id
      where
        s.turn_transition_id = 'b7300000-0000-0000-0000-000000000001'
        and r.slug like 'attsb-resource-%'
    ),
    200,
    'large payload: 200 snapshot rows written'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_resource_stockpiles sp
        join public.settlements st on st.id = sp.settlement_id
        join public.resources r on r.id = sp.resource_id
      where
        st.nation_id = 'b7400000-0000-0000-0000-000000000001'
        and r.slug like 'attsb-resource-%'
        and sp.quantity = 0
    ),
    0,
    'large payload: no stockpile left unchanged at 0'
  );

-- ===========================================================================
-- TEST 3-4: uncapped resource — plain quantityBefore + 200
-- ===========================================================================
select
  is (
    (
      select
        quantity
      from
        public.settlement_resource_stockpiles
      where
        settlement_id = 'b7500000-0000-0000-0000-000000000003'
        and resource_id = 'b7600000-0000-0000-0000-000000000005'
    ),
    200::numeric(18, 4),
    'large payload: uncapped stockpile quantity = 200'
  );

select
  is (
    (
      select
        quantity_after
      from
        public.settlement_turn_resource_snapshots
      where
        turn_transition_id = 'b7300000-0000-0000-0000-000000000001'
        and settlement_id = 'b7500000-0000-0000-0000-000000000003'
        and resource_id = 'b7600000-0000-0000-0000-000000000005'
    ),
    200::numeric(18, 4),
    'large payload: uncapped snapshot quantity_after = 200'
  );

-- ===========================================================================
-- TEST 5-6: capped resource 1 — clamped to 100 in both tables, for every settlement
-- ===========================================================================
select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_resource_stockpiles
      where
        resource_id = 'b7600000-0000-0000-0000-000000000001'
        and quantity = 100::numeric(18, 4)
    ),
    10,
    'large payload: all 10 capped stockpiles clamped to 100'
  );

select
  is (
    (
      select
        count(*)::integer
      from
        public.settlement_turn_resource_snapshots
      where
        turn_transition_id = 'b7300000-0000-0000-0000-000000000001'
        and resource_id = 'b7600000-0000-0000-0000-000000000001'
        and quantity_after = 100::numeric(18, 4)
    ),
    10,
    'large payload: all 10 capped snapshots record clamped quantity_after 100'
  );

-- ===========================================================================
-- TEST 7: adjustment_amount = quantity_before - prior quantity_after (7 - 5)
-- ===========================================================================
select
  is (
    (
      select
        adjustment_amount
      from
        public.settlement_turn_resource_snapshots
      where
        turn_transition_id = 'b7300000-0000-0000-0000-000000000001'
        and settlement_id = 'b7500000-0000-0000-0000-000000000002'
        and resource_id = 'b7600000-0000-0000-0000-000000000002'
    ),
    2::numeric(18, 4),
    'large payload: adjustment_amount computed set-wise against prior turn'
  );

reset role;

-- ===========================================================================
-- TEST 8: statement count does not scale with element count — the write path is
-- set-based (jsonb_to_recordset over the whole payload, no per-element FOR loop).
-- ===========================================================================
select
  ok (
    pg_get_functiondef(
      'public.internal_apply_turn_transition_stockpile_deltas(uuid,uuid,integer,jsonb)'::regprocedure
    ) like '%jsonb_to_recordset%'
    and pg_get_functiondef(
      'public.internal_apply_turn_transition_stockpile_deltas(uuid,uuid,integer,jsonb)'::regprocedure
    ) not like '%end loop%',
    'stockpile delta write path is set-based: no per-element loop'
  );

rollback;
