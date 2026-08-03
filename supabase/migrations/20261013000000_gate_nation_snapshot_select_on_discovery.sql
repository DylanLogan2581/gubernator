-- Migration: gate_nation_snapshot_select_on_discovery
-- #1132: nation_turn_snapshots (20260907000000) and nation_currency_snapshots
-- (20260918000001) SELECT policies used plain current_user_has_world_access
-- (world_id), unlike nations/nation_treaties/nation_currencies which are
-- discovery-gated (20260911000000). That let any world member enumerate
-- undiscovered nations' ids and read their tax/tribute/money-supply/
-- confidence history, and leaked treaty existence via
-- tribute_paid_by_resource_json between nations the caller has met neither
-- of. (nation_resource_stockpiles intentionally stays world-access per
-- 20260911000000 §5b -- these two snapshot tables are not covered by that
-- rationale, since their rows are keyed directly to a specific nation_id.)
--
-- Fix: both SELECT policies now gate on nation_visible_to_current_user
-- (nation_id), matching nations/nation_treaties/nation_currencies.
-- ---------------------------------------------------------------------------
drop policy "nation_turn_snapshots_select_world_access" on public.nation_turn_snapshots;

create policy "nation_turn_snapshots_select_visible" on public.nation_turn_snapshots for
select
  to authenticated using (public.nation_visible_to_current_user (nation_id));

drop policy "nation_currency_snapshots_select_world_access" on public.nation_currency_snapshots;

create policy "nation_currency_snapshots_select_visible" on public.nation_currency_snapshots for
select
  to authenticated using (public.nation_visible_to_current_user (nation_id));
