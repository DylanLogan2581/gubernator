-- Migration: add_icon_to_config_entities
-- Adds a nullable `icon` text column (a curated Lucide icon name, see
-- src/components/shared/iconPicker/CuratedIcons.ts) to the five config
-- entity tables so lists/panels can render an icon chip per type
-- (docs/ui-redesign.md §5). Null/unknown values fall back to a default
-- icon client-side; no backfill needed.
alter table public.resources
add column icon text null;

alter table public.job_definitions
add column icon text null;

alter table public.building_blueprints
add column icon text null;

alter table public.deposit_types
add column icon text null;

alter table public.managed_population_types
add column icon text null;

alter table public.resources
add constraint resources_icon_max_length_check check (
  icon is null
  or char_length(icon) <= 64
);

alter table public.job_definitions
add constraint job_definitions_icon_max_length_check check (
  icon is null
  or char_length(icon) <= 64
);

alter table public.building_blueprints
add constraint building_blueprints_icon_max_length_check check (
  icon is null
  or char_length(icon) <= 64
);

alter table public.deposit_types
add constraint deposit_types_icon_max_length_check check (
  icon is null
  or char_length(icon) <= 64
);

alter table public.managed_population_types
add constraint managed_population_types_icon_max_length_check check (
  icon is null
  or char_length(icon) <= 64
);

-- ---------------------------------------------------------------------------
-- settlement_stockpiles_view: expose the resource's icon so
-- SettlementStockpilesPanel can render a per-resource icon chip instead of a
-- fixed domain icon. Drop and recreate per the same constraint noted in
-- 20260602000006_add_settlement_effective_storage_cap.sql (column list
-- changes, no CREATE OR REPLACE VIEW column-list narrowing in older PG).
-- ---------------------------------------------------------------------------
drop view public.settlement_stockpiles_view;

create view public.settlement_stockpiles_view
with
  (security_invoker = true) as
select
  srs.settlement_id,
  srs.resource_id,
  r.name as resource_name,
  r.icon as resource_icon,
  r.is_system_resource,
  srs.quantity,
  public.settlement_effective_storage_cap (srs.settlement_id, srs.resource_id) as effective_cap
from
  public.settlement_resource_stockpiles srs
  join public.resources r on r.id = srs.resource_id;

grant
select
  on public.settlement_stockpiles_view to authenticated;
