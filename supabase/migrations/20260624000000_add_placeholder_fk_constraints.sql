-- Migration: add_placeholder_fk_constraints
-- Adds deferred FK constraints for placeholder UUID columns that were previously
-- unconstrained pending completion of their target tables. All constraints use
-- ON DELETE SET NULL per system semantics (cascade not appropriate for auth/audit
-- boundaries). Each column gets a covering index for efficient SET NULL ops.
-- ---------------------------------------------------------------------------
-- deposit_instances.discovered_by_event_id → events
-- ---------------------------------------------------------------------------
alter table public.deposit_instances
add constraint deposit_instances_discovered_by_event_id_fkey foreign key (discovered_by_event_id) references public.events (id) on delete set null;

create index deposit_instances_discovered_by_event_id_idx on public.deposit_instances (discovered_by_event_id);

comment on column public.deposit_instances.discovered_by_event_id is 'References the event that caused this deposit to be discovered. Null if no
   event is associated (e.g., admin-created deposits). Set to null on event
   deletion.';

-- ---------------------------------------------------------------------------
-- notifications.citizen_id → citizens
-- ---------------------------------------------------------------------------
alter table public.notifications
add constraint notifications_citizen_id_fkey foreign key (citizen_id) references public.citizens (id) on delete set null;

create index notifications_citizen_id_idx on public.notifications (citizen_id);

comment on column public.notifications.citizen_id is 'References the citizen relevant to this notification. Null if no specific
   citizen is involved. Set to null on citizen deletion.';

-- ---------------------------------------------------------------------------
-- notifications.event_id → events
-- ---------------------------------------------------------------------------
alter table public.notifications
add constraint notifications_event_id_fkey foreign key (event_id) references public.events (id) on delete set null;

create index notifications_event_id_idx on public.notifications (event_id);

comment on column public.notifications.event_id is 'References the event that triggered this notification. Null if no event is
   involved. Set to null on event deletion.';
