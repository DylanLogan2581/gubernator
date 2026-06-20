-- Migration: add_turn_log_entries_filter_indexes
-- Adds composite indexes for filter combinations used by the turn log browser.
-- The browser queries turn_log_entries by world_id plus optional categorical
-- columns; without these indexes every page fetch degrades to a full-table scan
-- (filtered only by the existing single-column world_id index).
-- ---------------------------------------------------------------------------
-- (world_id, log_category) — most common UI filter
create index if not exists turn_log_entries_world_category_idx on public.turn_log_entries (world_id, log_category);

-- (world_id, settlement_id) — settlement-scoped embed
create index if not exists turn_log_entries_world_settlement_idx on public.turn_log_entries (world_id, settlement_id)
where
  settlement_id is not null;

-- (world_id, nation_id) — nation-scoped embed
create index if not exists turn_log_entries_world_nation_idx on public.turn_log_entries (world_id, nation_id)
where
  nation_id is not null;

-- (world_id, citizen_id) — citizen filter
create index if not exists turn_log_entries_world_citizen_idx on public.turn_log_entries (world_id, citizen_id)
where
  citizen_id is not null;

-- (world_id, resource_id) — resource filter
create index if not exists turn_log_entries_world_resource_idx on public.turn_log_entries (world_id, resource_id)
where
  resource_id is not null;
