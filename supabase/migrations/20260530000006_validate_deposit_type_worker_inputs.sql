-- Migration: validate_deposit_type_worker_inputs
-- Adds shape and referential validation for worker_inputs_json on deposit_types.
-- Each element must be a { resource_id, amount_per_worker } object.  Extra keys
-- are rejected.  resource_id must reference a non-deleted resource in the same
-- world.  Empty arrays are allowed.
-- ---------------------------------------------------------------------------
create or replace function public.is_valid_worker_inputs_array (arr jsonb, p_world_id uuid) returns boolean language plpgsql stable
set
  search_path = '' as $$
begin
  if arr is null or jsonb_typeof (arr) != 'array' then
    return false;
  end if;

  -- Validate shape of every element
  if exists (
    select
      1
    from
      jsonb_array_elements (arr) as e (entry)
    where
      jsonb_typeof (e.entry) != 'object'
      or not (e.entry ? 'resource_id')
      or jsonb_typeof (e.entry -> 'resource_id') != 'string'
      or not (e.entry ? 'amount_per_worker')
      or jsonb_typeof (e.entry -> 'amount_per_worker') != 'number'
      or (e.entry - '{resource_id,amount_per_worker}'::text[]) != '{}'::jsonb
  ) then
    return false;
  end if;

  -- Validate each resource_id references a live resource in the same world
  if exists (
    select
      1
    from
      jsonb_array_elements (arr) as e (entry)
    where
      not exists (
        select
          1
        from
          public.resources r
        where
          r.id = (e.entry ->> 'resource_id')::uuid
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

alter table public.deposit_types
add constraint deposit_types_worker_inputs_json_check check (
  public.is_valid_worker_inputs_array (worker_inputs_json, world_id)
);
