-- Migration: add_turn_log_entries_citizen_fkey
-- Wires turn_log_entries.citizen_id to the citizens table. The column was added
-- as a placeholder before the citizens table existed, so no foreign key was
-- declared. The turn log browser embeds citizens via
-- citizens!turn_log_entries_citizen_id_fkey(name); without the constraint
-- PostgREST cannot resolve the relationship ("Could not find a relationship
-- between 'turn_log_entries' and 'citizens' in the schema cache").
-- ---------------------------------------------------------------------------
-- Null out any orphaned references first so the constraint can be added. These
-- rows are already dangling (the citizen no longer exists), and nulling them
-- matches the on-delete-set-null behaviour the constraint enforces going
-- forward.
update public.turn_log_entries e
set
  citizen_id = null
where
  e.citizen_id is not null
  and not exists (
    select
      1
    from
      public.citizens c
    where
      c.id = e.citizen_id
  );

alter table public.turn_log_entries
add constraint turn_log_entries_citizen_id_fkey foreign key (citizen_id) references public.citizens (id) on delete set null;

comment on column public.turn_log_entries.citizen_id is 'Optional citizen the log entry concerns; references public.citizens, nulled when the citizen is deleted.';
