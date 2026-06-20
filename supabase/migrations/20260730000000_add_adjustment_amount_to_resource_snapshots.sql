-- Migration: add_adjustment_amount_to_resource_snapshots
-- Records admin stockpile edits that occur between turns as a first-class flow
-- component so per-turn resource flows reconcile to the actual quantity delta.
--
-- Changes:
--   1. adjustment_amount column on settlement_turn_resource_snapshots
--      = quantity_before[N] – quantity_after[N-1] (zero when no admin edit)
--   2. Column-level INSERT grant for authenticated
--   3. nation_turn_resource_aggregates / world_turn_resource_aggregates recreated
--      with adjustment_amount column and updated net_amount formula
--   4. internal_apply_turn_transition_stockpile_deltas updated to look up the
--      previous turn's quantity_after and compute adjustment_amount
-- ---------------------------------------------------------------------------
-- Step 1: Add column
-- ---------------------------------------------------------------------------
alter table public.settlement_turn_resource_snapshots
add column adjustment_amount numeric(18, 4) not null default 0;

comment on column public.settlement_turn_resource_snapshots.adjustment_amount is 'Admin stockpile edit recorded between the previous turn and this turn, computed as quantity_before[N] - quantity_after[N-1]. Zero for the first snapshot or when no admin edit occurred between turns.';

-- ---------------------------------------------------------------------------
-- Step 2: Grant INSERT on the new column (table-level INSERT was re-granted
-- per-column in 20260602000003; the new column must be added explicitly).
-- ---------------------------------------------------------------------------
grant insert (adjustment_amount) on public.settlement_turn_resource_snapshots to authenticated;

-- ---------------------------------------------------------------------------
-- Step 3: Recreate resource aggregate views with adjustment_amount
-- DROP + CREATE required because net_amount formula changes (column replacement
-- is not permitted via CREATE OR REPLACE VIEW).
-- ---------------------------------------------------------------------------
drop view if exists public.nation_turn_resource_aggregates;

create view public.nation_turn_resource_aggregates
with
  (security_invoker = true) as
select
  sts.world_id,
  s.nation_id,
  sts.turn_number,
  sts.resource_id,
  r.name as resource_name,
  sum(sts.produced_amount) as produced_amount,
  sum(sts.consumed_amount) as consumed_amount,
  sum(sts.trade_in_amount) as trade_in_amount,
  sum(sts.trade_out_amount) as trade_out_amount,
  sum(sts.adjustment_amount) as adjustment_amount,
  sum(
    sts.produced_amount - sts.consumed_amount + sts.trade_in_amount - sts.trade_out_amount + sts.adjustment_amount
  ) as net_amount
from
  public.settlement_turn_resource_snapshots sts
  join public.settlements s on s.id = sts.settlement_id
  join public.resources r on r.id = sts.resource_id
group by
  sts.world_id,
  s.nation_id,
  sts.turn_number,
  sts.resource_id,
  r.name;

comment on view public.nation_turn_resource_aggregates is 'Per-nation-per-turn-per-resource sums from settlement_turn_resource_snapshots at query time. SECURITY INVOKER — inherits caller RLS from the underlying tables. net_amount includes adjustment_amount for full reconciliation.';

grant
select
  on public.nation_turn_resource_aggregates to authenticated;

drop view if exists public.world_turn_resource_aggregates;

create view public.world_turn_resource_aggregates
with
  (security_invoker = true) as
select
  sts.world_id,
  sts.turn_number,
  sts.resource_id,
  r.name as resource_name,
  sum(sts.produced_amount) as produced_amount,
  sum(sts.consumed_amount) as consumed_amount,
  sum(sts.trade_in_amount) as trade_in_amount,
  sum(sts.trade_out_amount) as trade_out_amount,
  sum(sts.adjustment_amount) as adjustment_amount,
  sum(
    sts.produced_amount - sts.consumed_amount + sts.trade_in_amount - sts.trade_out_amount + sts.adjustment_amount
  ) as net_amount
from
  public.settlement_turn_resource_snapshots sts
  join public.resources r on r.id = sts.resource_id
group by
  sts.world_id,
  sts.turn_number,
  sts.resource_id,
  r.name;

comment on view public.world_turn_resource_aggregates is 'Per-world-per-turn-per-resource sums from settlement_turn_resource_snapshots at query time. SECURITY INVOKER — inherits caller RLS from the underlying tables. net_amount includes adjustment_amount for full reconciliation.';

grant
select
  on public.world_turn_resource_aggregates to authenticated;

-- ---------------------------------------------------------------------------
-- Step 4: Update internal_apply_turn_transition_stockpile_deltas to compute
-- adjustment_amount = quantity_before[N] - previous_turn.quantity_after.
-- Zero when no previous snapshot exists (first-ever snapshot for this
-- settlement+resource pair).
-- ---------------------------------------------------------------------------
create or replace function public.internal_apply_turn_transition_stockpile_deltas (
  p_transition_id uuid,
  p_world_id uuid,
  p_expected_turn_number integer,
  p_payload jsonb
) returns integer language plpgsql security definer
set
  search_path = '' as $$
declare
  v_delta              jsonb;
  v_settlement_id      uuid;
  v_resource_id        uuid;
  v_quantity_before    numeric(18, 4);
  v_quantity_after     numeric(18, 4);
  v_produced_amount    numeric(18, 4);
  v_consumed_amount    numeric(18, 4);
  v_trade_in_amount    numeric(18, 4);
  v_trade_out_amount   numeric(18, 4);
  v_effective_cap      numeric;
  v_clamped_quantity   numeric(18, 4);
  v_prev_qty_after     numeric(18, 4);
  v_adjustment_amount  numeric(18, 4);
  v_count              integer := 0;
begin
  for v_delta in
    select value
    from jsonb_array_elements(coalesce(p_payload -> 'stockpileDeltas', '[]'::jsonb))
  loop
    v_settlement_id    := (v_delta ->> 'settlementId')::uuid;
    v_resource_id      := (v_delta ->> 'resourceId')::uuid;
    v_quantity_before  := coalesce((v_delta ->> 'quantityBefore')::numeric, 0);
    v_quantity_after   := coalesce((v_delta ->> 'quantityAfter')::numeric, 0);
    v_produced_amount  := coalesce((v_delta ->> 'produced')::numeric, 0);
    v_consumed_amount  := coalesce((v_delta ->> 'consumed')::numeric, 0);
    v_trade_in_amount  := coalesce((v_delta ->> 'tradeIn')::numeric, 0);
    v_trade_out_amount := coalesce((v_delta ->> 'tradeOut')::numeric, 0);

    -- Server-side clamp to [0, effective_cap] (defence-in-depth; engine already clamps).
    -- Use _internal variant: auth was already verified by the orchestrator.
    v_effective_cap    := public.settlement_effective_storage_cap_internal(v_settlement_id, v_resource_id);
    v_clamped_quantity := greatest(0, least(v_quantity_after, v_effective_cap));

    -- Look up the previous turn's quantity_after for this settlement+resource.
    -- Non-NULL only when a prior snapshot exists; NULL = first snapshot.
    -- The index on (settlement_id, resource_id, turn_number DESC) makes this fast.
    select quantity_after
    into v_prev_qty_after
    from public.settlement_turn_resource_snapshots
    where settlement_id = v_settlement_id
      and resource_id   = v_resource_id
      and world_id      = p_world_id
      and turn_number   = p_expected_turn_number - 1
    limit 1;

    -- adjustment_amount = gap between this turn's starting quantity and the
    -- previous turn's ending quantity. Non-zero only when an admin called
    -- set_settlement_stockpile_quantity between turns. Zero for the first snapshot.
    v_adjustment_amount := v_quantity_before - coalesce(v_prev_qty_after, v_quantity_before);

    update public.settlement_resource_stockpiles
    set
      quantity = v_clamped_quantity
    where
      settlement_id = v_settlement_id
      and resource_id = v_resource_id;

    insert into
      public.settlement_turn_resource_snapshots (
        turn_transition_id,
        world_id,
        settlement_id,
        resource_id,
        turn_number,
        quantity_before,
        quantity_after,
        produced_amount,
        consumed_amount,
        trade_in_amount,
        trade_out_amount,
        adjustment_amount
      )
    values
      (
        p_transition_id,
        p_world_id,
        v_settlement_id,
        v_resource_id,
        p_expected_turn_number,
        v_quantity_before,
        v_clamped_quantity,
        v_produced_amount,
        v_consumed_amount,
        v_trade_in_amount,
        v_trade_out_amount,
        v_adjustment_amount
      ) on conflict on constraint settlement_turn_resource_snapshots_unique do nothing;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.internal_apply_turn_transition_stockpile_deltas (uuid, uuid, integer, jsonb)
from
  public;
