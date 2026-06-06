-- Allow base_capacity = 0 for standard and construction jobs.
-- The original constraint required base_capacity > 0; a zero-capacity job is a
-- valid placeholder that world admins use before assigning workers.
alter table public.job_definitions
drop constraint job_definitions_base_capacity_positive_check,
add constraint job_definitions_base_capacity_non_negative_check check (
  base_capacity is null
  or base_capacity >= 0
);
