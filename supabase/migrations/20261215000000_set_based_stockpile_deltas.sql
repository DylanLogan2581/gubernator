-- Migration: set-based stockpile deltas in the apply_turn_transition write path
--
-- Phase 2 of the DB scaling roadmap (issue #1270).
--
-- internal_apply_turn_transition_stockpile_deltas previously looped over every
-- (settlement x resource) delta and ran 3+ statements per element (storage-cap
-- lookup, prior-snapshot select, stockpile update, snapshot insert). At ~200
-- settlements x ~30 resources that is ~24k statements in a single transaction —
-- the dominant statement_timeout / 30s-RPC-cap risk for large worlds.
--
-- This replaces the loop with a bounded, set-based write path: one call to
-- ensure_str_snapshot_partitions (unchanged, still before any insert) plus a
-- single statement whose CTEs parse the payload, compute effective storage caps
-- set-wise, look up prior-turn snapshots set-wise, insert the snapshot rows
-- (data-modifying CTE, same ON CONFLICT DO NOTHING) and update the stockpiles.
--
-- Behaviour is preserved exactly, including:
--   * clamp to [0, effective_cap] with the same cap expression as
--     settlement_effective_storage_cap_internal (pure, no side effects),
--   * adjustment_amount = quantity_before - coalesce(prev quantity_after, quantity_before),
--   * duplicate (settlement, resource) elements: the snapshot insert keeps the
--     first occurrence (ON CONFLICT DO NOTHING) and the stockpile update keeps
--     the last occurrence, matching the old row-by-row ordering,
--   * the return value is the number of payload elements processed.
--
-- RLS: none (function is security definer, unchanged grants).
-- Typegen: none (signature unchanged).
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
  v_deltas jsonb    := coalesce(p_payload -> 'stockpileDeltas', '[]'::jsonb);
  v_count  integer  := coalesce(jsonb_array_length(v_deltas), 0);
begin
  if v_count = 0 then
    return 0;
  end if;

  -- Ensure the target world/turn partition exists before any insert below.
  perform public.ensure_str_snapshot_partitions(p_world_id, p_expected_turn_number);

  with parsed as (
    select
      d.settlement_id,
      d.resource_id,
      d.ord,
      coalesce(d.quantity_before, 0)::numeric(18, 4) as quantity_before,
      coalesce(d.quantity_after, 0)::numeric(18, 4)  as quantity_after,
      coalesce(d.produced, 0)::numeric(18, 4)        as produced_amount,
      coalesce(d.consumed, 0)::numeric(18, 4)        as consumed_amount,
      coalesce(d.trade_in, 0)::numeric(18, 4)        as trade_in_amount,
      coalesce(d.trade_out, 0)::numeric(18, 4)       as trade_out_amount
    from
      rows from (
        jsonb_to_recordset(v_deltas) as (
          "settlementId"   uuid,
          "resourceId"     uuid,
          "quantityBefore" numeric,
          "quantityAfter"  numeric,
          "produced"       numeric,
          "consumed"       numeric,
          "tradeIn"        numeric,
          "tradeOut"       numeric
        )
      ) with ordinality as d (
        settlement_id,
        resource_id,
        quantity_before,
        quantity_after,
        produced,
        consumed,
        trade_in,
        trade_out,
        ord
      )
  ),
  pairs as (
    select distinct settlement_id, resource_id from parsed
  ),
  -- Set-based equivalent of settlement_effective_storage_cap_internal's
  -- building-effect term, aggregated once for every settlement in the payload.
  building_caps as (
    select
      sb.settlement_id,
      (e.entry ->> 'resource_id')::uuid       as resource_id,
      sum((e.entry ->> 'amount')::numeric)    as bonus
    from public.settlement_buildings sb
      join public.building_blueprint_tiers t on t.id = sb.current_tier_id
      cross join lateral jsonb_array_elements(t.effects_json) as e (entry)
    where sb.settlement_id in (select settlement_id from pairs)
      and sb.state = 'active'
      and (e.entry ->> 'type') = 'resource_storage_increase'
    group by 1, 2
  ),
  caps as (
    select
      p.settlement_id,
      p.resource_id,
      coalesce(r.base_stockpile_cap, 0) + coalesce(b.bonus, 0) as effective_cap
    from pairs p
      left join public.resources r on r.id = p.resource_id
      left join building_caps b
        on b.settlement_id = p.settlement_id
        and b.resource_id = p.resource_id
  ),
  resolved as (
    select
      p.*,
      greatest(0, least(p.quantity_after, c.effective_cap))::numeric(18, 4) as clamped_quantity
    from parsed p
      join caps c
        on c.settlement_id = p.settlement_id
        and c.resource_id = p.resource_id
  ),
  -- Previous turn's quantity_after per (settlement, resource); NULL when this is
  -- the first snapshot. Matches the old per-row lookup (arbitrary single row).
  prev as (
    select distinct
      on (s.settlement_id, s.resource_id) s.settlement_id,
      s.resource_id,
      s.quantity_after
    from public.settlement_turn_resource_snapshots s
    where s.world_id = p_world_id
      and s.turn_number = p_expected_turn_number - 1
      and (s.settlement_id, s.resource_id) in (select settlement_id, resource_id from pairs)
    order by s.settlement_id, s.resource_id
  ),
  -- First occurrence per (settlement, resource) wins, mirroring the old loop
  -- where the earliest element inserted and later duplicates hit ON CONFLICT.
  snapshot_rows as (
    select distinct
      on (r.settlement_id, r.resource_id) r.*
    from resolved r
    order by r.settlement_id, r.resource_id, r.ord
  ),
  ins as (
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
    select
      p_transition_id,
      p_world_id,
      sr.settlement_id,
      sr.resource_id,
      p_expected_turn_number,
      sr.quantity_before,
      sr.clamped_quantity,
      sr.produced_amount,
      sr.consumed_amount,
      sr.trade_in_amount,
      sr.trade_out_amount,
      (sr.quantity_before - coalesce(pv.quantity_after, sr.quantity_before))::numeric(18, 4)
    from snapshot_rows sr
      left join prev pv
        on pv.settlement_id = sr.settlement_id
        and pv.resource_id = sr.resource_id
    on conflict on constraint settlement_turn_resource_snapshots_unique do nothing
  ),
  -- Last occurrence per (settlement, resource) wins, mirroring the old loop
  -- where each element's UPDATE overwrote the previous one.
  stockpile_rows as (
    select distinct
      on (r.settlement_id, r.resource_id) r.settlement_id,
      r.resource_id,
      r.clamped_quantity
    from resolved r
    order by r.settlement_id, r.resource_id, r.ord desc
  )
  update public.settlement_resource_stockpiles srs
  set
    quantity = u.clamped_quantity
  from stockpile_rows u
  where srs.settlement_id = u.settlement_id
    and srs.resource_id = u.resource_id;

  return v_count;
end;
$$;

comment on function public.internal_apply_turn_transition_stockpile_deltas (uuid, uuid, integer, jsonb) is 'Internal: applies the stockpileDeltas payload set-wise — one ensure_str_snapshot_partitions call plus a single statement that clamps to the effective storage cap, inserts settlement_turn_resource_snapshots rows (ON CONFLICT DO NOTHING) and updates settlement_resource_stockpiles. Statement count is independent of element count. Returns the number of payload elements processed. Not granted to authenticated.';

revoke all on function public.internal_apply_turn_transition_stockpile_deltas (uuid, uuid, integer, jsonb)
from
  public;

revoke
execute on function public.internal_apply_turn_transition_stockpile_deltas (uuid, uuid, integer, jsonb)
from
  anon,
  authenticated;
