-- Migration: index_parent_and_pending_citizen_ids
-- PostgreSQL does not automatically create indexes for foreign-key columns.
-- parent_a_citizen_id and parent_b_citizen_id are walked on every lineage
-- query (kinship-depth check, children-of-citizen pattern) and on every
-- ON DELETE SET NULL cascade when a citizen is removed. Without indexes those
-- paths full-scan the citizens table. The same issue applies to
-- pending_changed_by_citizen_id on nation_relationships. Partial indexes
-- (where column is not null) keep them lean for the common null case.
-- ---------------------------------------------------------------------------
create index if not exists citizens_parent_a_idx on public.citizens (parent_a_citizen_id)
where
  parent_a_citizen_id is not null;

create index if not exists citizens_parent_b_idx on public.citizens (parent_b_citizen_id)
where
  parent_b_citizen_id is not null;

create index if not exists nation_relationships_pending_changed_by_citizen_idx on public.nation_relationships (pending_changed_by_citizen_id)
where
  pending_changed_by_citizen_id is not null;
