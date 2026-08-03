-- Migration: set_based_stockpiles_view_cap
-- #1395: settlement_stockpiles_view computed effective_cap by calling the
-- public settlement_effective_storage_cap wrapper once per row.  That wrapper
-- re-resolves the row's world (settlements -> nations) and re-runs
-- current_user_has_world_access for every row, so the seeded world (~3k
-- stockpile rows) spent roughly 80% of a ~2.1s view scan re-proving the same
-- handful of world grants.  On slower hosts that crosses the `authenticated`
-- statement timeout and the end-turn state load fails outright.
--
-- The per-row check is redundant: the view is security_invoker over
-- settlement_resource_stockpiles, whose RLS select policy already restricts
-- the result set to worlds the caller may see.  settlement_buildings and
-- building_blueprint_tiers carry the same current_user_has_world_access
-- select policies, so computing the building bonus inline (still as the
-- invoker) cannot widen visibility either: a caller who can see a stockpile
-- row can see exactly the buildings and tiers that feed its cap.
--
-- The bonus is now aggregated set-based, grouped by (settlement, resource),
-- and joined once instead of evaluated per row.
--
-- Column list and types are unchanged, so no typegen churn.
-- ---------------------------------------------------------------------------
create or replace view public.settlement_stockpiles_view
with
  (security_invoker = true) as
with
  building_storage as (
    select
      sb.settlement_id,
      (e.entry ->> 'resource_id')::uuid as resource_id,
      sum((e.entry ->> 'amount')::numeric) as bonus
    from
      public.settlement_buildings sb
      join public.building_blueprint_tiers t on t.id = sb.current_tier_id
      cross join lateral jsonb_array_elements(t.effects_json) as e (entry)
    where
      sb.state = 'active'
      and (e.entry ->> 'type') = 'resource_storage_increase'
    group by
      sb.settlement_id,
      (e.entry ->> 'resource_id')::uuid
  )
select
  srs.settlement_id,
  srs.resource_id,
  r.name as resource_name,
  r.icon as resource_icon,
  r.icon_color as resource_icon_color,
  r.is_system_resource,
  srs.quantity,
  coalesce(r.base_stockpile_cap, 0) + coalesce(bs.bonus, 0) as effective_cap
from
  public.settlement_resource_stockpiles srs
  join public.resources r on r.id = srs.resource_id
  left join building_storage bs on bs.settlement_id = srs.settlement_id
  and bs.resource_id = srs.resource_id;

grant
select
  on public.settlement_stockpiles_view to authenticated;
