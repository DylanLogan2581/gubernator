-- Migration: add_nameset_covering_indexes
-- Adds covering indexes for FK reverse lookups on nameset_id columns.
-- Prevents full table scans when hard_delete_nameset cascades SET NULL.
-- Refs: #692 (DB-L5)
-- Covering indexes for nations and settlements nameset_id FK columns.
-- Partial index (WHERE nameset_id IS NOT NULL) sufficient since NULL values
-- don't participate in FK constraint checks.
create index nations_nameset_id_idx on public.nations (nameset_id)
where
  nameset_id is not null;

create index settlements_nameset_id_idx on public.settlements (nameset_id)
where
  nameset_id is not null;
