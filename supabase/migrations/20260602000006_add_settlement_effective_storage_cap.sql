-- Migration: add_settlement_effective_storage_cap
-- Extracts the effective-storage-cap calculation into a reusable SQL helper so
-- the simulation input loader and snapshot writer can call it without duplicating
-- the inline CTE that currently lives in settlement_stockpiles_view.
-- ---------------------------------------------------------------------------
-- Function: settlement_effective_storage_cap
-- Returns: base_stockpile_cap + sum of resource_storage_increase building effects
--          for the given (settlement, resource) pair.
-- STABLE SECURITY DEFINER: reads public tables without exposing write paths.
-- search_path = '' prevents search_path-injection attacks.
-- ---------------------------------------------------------------------------
create or replace function public.settlement_effective_storage_cap (p_settlement_id uuid, p_resource_id uuid) returns numeric language sql stable security definer
set
  search_path = '' as $$
  select coalesce(
    (select base_stockpile_cap from public.resources where id = p_resource_id),
    0
  ) + coalesce(
    (
      select sum((e.entry ->> 'amount')::numeric)
      from public.settlement_buildings sb
      join public.building_blueprint_tiers t on t.id = sb.current_tier_id
      cross join lateral jsonb_array_elements(t.effects_json) as e (entry)
      where sb.settlement_id = p_settlement_id
        and sb.state = 'active'
        and (e.entry ->> 'type') = 'resource_storage_increase'
        and (e.entry ->> 'resource_id')::uuid = p_resource_id
    ),
    0
  );
$$;

revoke all on function public.settlement_effective_storage_cap (uuid, uuid)
from
  public;

grant
execute on function public.settlement_effective_storage_cap (uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Update settlement_stockpiles_view to delegate to the helper.
-- Drop and recreate: CREATE OR REPLACE VIEW is not available in older PG
-- and the column list changes slightly (no inline CTE).
-- ---------------------------------------------------------------------------
drop view public.settlement_stockpiles_view;

create view public.settlement_stockpiles_view
with
  (security_invoker = true) as
select
  srs.settlement_id,
  srs.resource_id,
  r.name as resource_name,
  r.is_system_resource,
  srs.quantity,
  public.settlement_effective_storage_cap (srs.settlement_id, srs.resource_id) as effective_cap
from
  public.settlement_resource_stockpiles srs
  join public.resources r on r.id = srs.resource_id;

grant
select
  on public.settlement_stockpiles_view to authenticated;
