-- Migration: index_settlement_ready_set_by_citizen_id
-- Epic 3 issue: wire citizen fk on settlements. The settlements.description,
-- coord_x, and coord_z columns already exist on the original table, and the
-- ready_set_by_citizen_id foreign key to citizens(id) on delete set null was
-- established in 20260520000000_add_citizens.sql. The only remaining wiring
-- is a supporting index for the foreign-key column so citizen-targeted lookups
-- and the on delete set null cascade do not require a full settlements scan.
-- ---------------------------------------------------------------------------
create index if not exists settlements_ready_set_by_citizen_id_idx on public.settlements (ready_set_by_citizen_id)
where
  ready_set_by_citizen_id is not null;
