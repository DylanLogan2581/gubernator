-- Migration: nation_stockpile_delta_drift_check_and_upsert
-- #1126: internal_apply_turn_transition_nation_economy (§C37, latest body in
-- 20260915000001) applies each nationStockpileDeltas entry independently
-- with `greatest(0, quantity + delta)`:
--
--   1. A payer debit silently clamps at 0 while a paired payee credit (same
--      payload, e.g. treaty tribute) applies in full — concurrent spend
--      between the engine's snapshot and this apply (grant_nation_resources,
--      subsidize_construction_project, deposit_reserves) mints resources
--      out of thin air. Settlement stockpiles get a §H9 quantityBefore
--      re-validation; nation stockpiles had none.
--   2. Credits are UPDATE-only: a missing (nation, resource) row (seed
--      triggers only fire on INSERT and skip is_trashed resources) silently
--      drops the credit.
--
-- Fix: lock + verify instead of clamp for debits (delta < 0) — raise
-- state_drifted (same errcode/hint convention as the §H9/§H10 checks in
-- apply_turn_transition) when the actual balance can't cover the debit
-- without going negative, so the caller sees the failure instead of losing
-- resources. Since internal_apply_turn_transition_nation_economy runs inside
-- apply_turn_transition's outer failure-capture BEGIN/EXCEPTION block,
-- plpgsql's implicit savepoint means raising here rolls back every write
-- this call made (including any credit applied earlier in the same loop) —
-- the paired debit/credit are applied atomically or not at all, without
-- needing an explicit pairId in the payload. Credits (delta >= 0) upsert via
-- ON CONFLICT DO UPDATE.
-- ---------------------------------------------------------------------------
create or replace function public.internal_apply_turn_transition_nation_economy (
  p_transition_id uuid,
  p_world_id uuid,
  p_expected_turn_number integer,
  p_payload jsonb,
  out nation_stockpile_delta_count integer,
  out nation_turn_snapshot_count integer
) returns record language plpgsql security definer
set
  search_path = '' as $$
declare
  v_delta jsonb;
  v_snapshot jsonb;
  v_nation_id uuid;
  v_resource_id uuid;
  v_delta_amount numeric;
  v_actual_quantity numeric;
begin
  nation_stockpile_delta_count := 0;
  nation_turn_snapshot_count   := 0;

  for v_delta in
    select value from jsonb_array_elements(coalesce(p_payload -> 'nationStockpileDeltas', '[]'::jsonb))
  loop
    v_nation_id    := (v_delta ->> 'nationId')::uuid;
    v_resource_id  := (v_delta ->> 'resourceId')::uuid;
    v_delta_amount := coalesce((v_delta ->> 'delta')::numeric, 0);

    if v_delta_amount < 0 then
      select quantity into v_actual_quantity
      from public.nation_resource_stockpiles
      where nation_id = v_nation_id
        and resource_id = v_resource_id
      for update;

      if not found or v_actual_quantity + v_delta_amount < 0 then
        raise exception 'state diverged: nation stockpile (%,%) is % but payload debit % would go negative',
          v_nation_id, v_resource_id, coalesce(v_actual_quantity, 0), v_delta_amount
          using errcode = 'P0001', hint = 'state_drifted';
      end if;

      update public.nation_resource_stockpiles
      set quantity = quantity + v_delta_amount
      where nation_id = v_nation_id
        and resource_id = v_resource_id;
    else
      insert into
        public.nation_resource_stockpiles (nation_id, resource_id, quantity)
      values
        (v_nation_id, v_resource_id, v_delta_amount)
      on conflict on constraint nation_resource_stockpiles_nation_resource_unique do update
      set quantity = nation_resource_stockpiles.quantity + excluded.quantity;
    end if;

    nation_stockpile_delta_count := nation_stockpile_delta_count + 1;
  end loop;

  for v_snapshot in
    select value from jsonb_array_elements(coalesce(p_payload -> 'nationTurnSnapshots', '[]'::jsonb))
  loop
    insert into
      public.nation_turn_snapshots (
        turn_transition_id,
        world_id,
        nation_id,
        turn_number,
        tax_collected_by_resource_json,
        tribute_paid_by_resource_json,
        tribute_received_by_resource_json
      )
    values
      (
        p_transition_id,
        p_world_id,
        (v_snapshot ->> 'nationId')::uuid,
        p_expected_turn_number,
        coalesce(v_snapshot -> 'taxCollectedByResource', '{}'::jsonb),
        coalesce(v_snapshot -> 'tributePaidByResource', '{}'::jsonb),
        coalesce(v_snapshot -> 'tributeReceivedByResource', '{}'::jsonb)
      ) on conflict on constraint nation_turn_snapshots_unique do nothing;

    nation_turn_snapshot_count := nation_turn_snapshot_count + 1;
  end loop;
end;
$$;

revoke all on function public.internal_apply_turn_transition_nation_economy (uuid, uuid, integer, jsonb)
from
  public;

revoke
execute on function public.internal_apply_turn_transition_nation_economy (uuid, uuid, integer, jsonb)
from
  anon,
  authenticated;
