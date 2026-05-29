-- Migration: add_citizens_same_world_parent_check
-- Adds a BEFORE trigger that rejects any insert or update on citizens where
-- parent_a_citizen_id or parent_b_citizen_id belongs to a different world than
-- the child. A plain CHECK constraint cannot reference other tables, so a
-- trigger is required.
-- ---------------------------------------------------------------------------
create or replace function public.check_citizens_same_world_parents () returns trigger language plpgsql security definer
set
  search_path = '' as $$
declare
  v_parent_a_world_id uuid;
  v_parent_b_world_id uuid;
begin
  if new.parent_a_citizen_id is not null then
    select world_id into v_parent_a_world_id
    from public.citizens
    where id = new.parent_a_citizen_id;

    -- Only raise when the parent exists but belongs to a different world.
    -- If the parent does not exist, the FK constraint produces the appropriate error.
    if v_parent_a_world_id is not null and v_parent_a_world_id <> new.world_id then
      raise exception 'citizens: parent_a_citizen_id must belong to the same world as the child citizen'
        using errcode = 'P0001';
    end if;
  end if;

  if new.parent_b_citizen_id is not null then
    select world_id into v_parent_b_world_id
    from public.citizens
    where id = new.parent_b_citizen_id;

    if v_parent_b_world_id is not null and v_parent_b_world_id <> new.world_id then
      raise exception 'citizens: parent_b_citizen_id must belong to the same world as the child citizen'
        using errcode = 'P0001';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function public.check_citizens_same_world_parents ()
from
  public;

create trigger citizens_same_world_parents_check before insert
or
update on public.citizens for each row
execute function public.check_citizens_same_world_parents ();
