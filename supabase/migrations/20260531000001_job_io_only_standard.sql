-- Migration: job_io_only_standard
-- Constrains inputs_json and outputs_json on job_definitions so that only
-- standard jobs may carry non-empty arrays.  All other job types must have
-- empty arrays in both columns.
--
-- Cleans up existing data first so the constraint can be applied to databases
-- that already loaded the current seed (which had non-empty IO on trader and
-- deposit rows).
-- ---------------------------------------------------------------------------
-- 1. Clean up any existing non-standard rows that have non-empty IO arrays.
update public.job_definitions
set
  inputs_json = '[]',
  outputs_json = '[]'
where
  job_type <> 'standard';

-- 2. Add CHECK constraints that enforce the invariant going forward.
alter table public.job_definitions
add constraint job_definitions_inputs_json_standard_only_check check (
  job_type = 'standard'
  or (
    jsonb_typeof(inputs_json) = 'array'
    and jsonb_array_length(inputs_json) = 0
  )
),
add constraint job_definitions_outputs_json_standard_only_check check (
  job_type = 'standard'
  or (
    jsonb_typeof(outputs_json) = 'array'
    and jsonb_array_length(outputs_json) = 0
  )
);
