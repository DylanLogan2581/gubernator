-- Migration: prevent_duplicate_running_turn_transitions
-- Ensures a world cannot start two running transitions from the same turn.
-- ---------------------------------------------------------------------------
create unique index turn_transitions_one_running_per_world_from_turn_idx on public.turn_transitions (world_id, from_turn_number)
where
  status = 'running';
