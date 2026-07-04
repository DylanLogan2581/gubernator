-- Migration: align_fk_delete_semantics_and_audit_columns
-- Two FK-hygiene fixes (issue #967):
--
-- 1. The composite (id, world_id) FKs added in
--    20260528000010_replace_same_world_triggers_with_composite_fks.sql carry
--    no ON DELETE action (defaults to NO ACTION), while the pre-existing
--    single-column FKs on the same columns are ON DELETE CASCADE
--    (nation_relationships.from_nation_id/to_nation_id) or ON DELETE SET NULL
--    (citizens.parent_a_citizen_id/parent_b_citizen_id). Deletion currently
--    only works because the single-column FK fires first and removes the
--    child row before the composite FK is checked; two FKs on the same
--    columns with divergent delete semantics is fragile. Align the composite
--    FKs to match so behavior does not depend on FK check order.
--
-- 2. turn_transitions.initiated_by_user_id and partnerships.changed_by_user_id
--    reference public.users ON DELETE RESTRICT, while public.users.id
--    cascades from auth.users ON DELETE CASCADE. Deleting an auth user
--    referenced by either audit column currently fails.
--    Decision: partnerships.changed_by_user_id is nullable and exists purely
--    for attribution, so it moves to ON DELETE SET NULL -- deleting the user
--    clears attribution instead of blocking account deletion.
--    turn_transitions.initiated_by_user_id is NOT NULL (every transition must
--    record who ran it) and stays ON DELETE RESTRICT by design: hard-deleting
--    a user who has ever run a turn transition is intentionally blocked so
--    the audit trail is never silently reattributed to nobody. Account
--    deletion flows must reassign or retain (e.g. suspend rather than
--    hard-delete) such users instead of relying on cascade/set-null here.
-- ---------------------------------------------------------------------------
-- ---------------------------------------------------------------------------
-- 1. Align composite FK delete actions with their single-column counterparts.
-- ---------------------------------------------------------------------------
alter table public.nation_relationships
drop constraint nation_relationships_from_nation_world_fkey,
add constraint nation_relationships_from_nation_world_fkey foreign key (from_nation_id, world_id) references public.nations (id, world_id) on delete cascade;

alter table public.nation_relationships
drop constraint nation_relationships_to_nation_world_fkey,
add constraint nation_relationships_to_nation_world_fkey foreign key (to_nation_id, world_id) references public.nations (id, world_id) on delete cascade;

alter table public.citizens
drop constraint citizens_parent_a_world_fkey,
add constraint citizens_parent_a_world_fkey foreign key (parent_a_citizen_id, world_id) references public.citizens (id, world_id) on delete set null;

alter table public.citizens
drop constraint citizens_parent_b_world_fkey,
add constraint citizens_parent_b_world_fkey foreign key (parent_b_citizen_id, world_id) references public.citizens (id, world_id) on delete set null;

-- ---------------------------------------------------------------------------
-- 2. Align partnerships.changed_by_user_id to ON DELETE SET NULL so deleting
--    a user who once amended a partnership does not block account deletion.
--    turn_transitions.initiated_by_user_id is left untouched (NOT NULL,
--    ON DELETE RESTRICT) -- see decision above.
-- ---------------------------------------------------------------------------
alter table public.partnerships
drop constraint partnerships_changed_by_user_id_fkey,
add constraint partnerships_changed_by_user_id_fkey foreign key (changed_by_user_id) references public.users (id) on delete set null;

comment on column public.partnerships.changed_by_user_id is 'Admin who made the change. Set to null when the referenced user is deleted so account deletion is never blocked by this audit column.';

comment on column public.turn_transitions.initiated_by_user_id is 'User who initiated the turn transition. NOT NULL and ON DELETE RESTRICT by design: this audit trail must always name its initiator, so hard-deleting a user who has ever run a turn transition is intentionally blocked. Account-deletion flows must handle such users separately (e.g. suspend rather than hard-delete).';
