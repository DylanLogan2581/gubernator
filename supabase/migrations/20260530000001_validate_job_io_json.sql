-- Migration: validate_job_io_json
-- Adds shape and referential validation for inputs_json and outputs_json on
-- job_definitions.  Each must be a JSON array of objects with:
--   resource_id       text   (UUID string referencing a non-deleted resource
--                             in the same world)
--   amount_per_worker number
--   notes             text   (optional)
-- Extra keys are rejected.  Empty arrays are allowed.
-- ---------------------------------------------------------------------------
create or replace function public.is_valid_job_io_array (arr jsonb, p_world_id uuid) returns boolean language plpgsql stable
set
  search_path = '' as $$
begin
  if arr is null or jsonb_typeof(arr) != 'array' then
    return false;
  end if;

  -- Validate the shape of every element
  if exists (
    select 1
    from jsonb_array_elements(arr) as e (entry)
    where
      jsonb_typeof(e.entry) != 'object'
      or not (e.entry ? 'resource_id')
      or jsonb_typeof(e.entry -> 'resource_id') != 'string'
      or not (e.entry ? 'amount_per_worker')
      or jsonb_typeof(e.entry -> 'amount_per_worker') != 'number'
      or (
        (e.entry ? 'notes')
        and jsonb_typeof(e.entry -> 'notes') != 'string'
      )
      or (e.entry - '{resource_id,amount_per_worker,notes}'::text[]) != '{}'::jsonb
  ) then
    return false;
  end if;

  -- Validate each resource_id references a live resource in the same world
  if exists (
    select 1
    from jsonb_array_elements(arr) as e (entry)
    where not exists (
      select 1
      from public.resources r
      where r.id = (e.entry ->> 'resource_id')::uuid
        and r.world_id = p_world_id
        and not r.is_deleted
    )
  ) then
    return false;
  end if;

  return true;
exception
  when others then
    return false;
end;
$$;

alter table public.job_definitions
add constraint job_definitions_inputs_json_check check (
  public.is_valid_job_io_array (inputs_json, world_id)
),
add constraint job_definitions_outputs_json_check check (
  public.is_valid_job_io_array (outputs_json, world_id)
);
