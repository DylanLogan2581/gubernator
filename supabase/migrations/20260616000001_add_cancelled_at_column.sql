-- Migration: add_cancelled_at_column
-- Adds cancelled_at timestamp to track when construction projects were cancelled.
-- Used for sorting cancelled projects in UI.
-- ---------------------------------------------------------------------------
alter table public.construction_projects
add column cancelled_at timestamptz;

-- Update existing cancelled projects to have cancelled_at = updated_at (best effort)
update public.construction_projects
set
  cancelled_at = updated_at
where
  status = 'cancelled'
  and cancelled_at is null;
