-- Revoke direct column-level UPDATE on pause_reason_last_transition from
-- authenticated. This field is written exclusively by apply_turn_transition
-- (SECURITY DEFINER, runs as function owner, bypasses column grants).
--
-- quantity_per_transition was moved from trade_routes to trade_route_legs by
-- migration 20260604000011_add_trade_route_legs.sql; dropping the column from
-- trade_routes also removed its column grant. trade_route_legs carries only a
-- SELECT grant for authenticated, so quantity changes were already restricted
-- to the SECURITY DEFINER RPCs (propose_trade_route, replace_trade_route).
--
-- trade_routes_update_admin_or_manager policy is retained — it scopes any
-- future grantable column to Nation Managers and World Admins on either side.
revoke
update (pause_reason_last_transition) on public.trade_routes
from
  authenticated;
