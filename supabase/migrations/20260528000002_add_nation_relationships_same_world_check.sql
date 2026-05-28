-- Migration: add_nation_relationships_same_world_check
-- Adds a BEFORE trigger that rejects any insert or update on
-- nation_relationships where from_nation_id and to_nation_id belong to
-- different worlds. A plain CHECK constraint cannot reference other tables, so
-- a trigger is required.
-- ---------------------------------------------------------------------------
create or replace function public.check_nation_relationships_same_world () returns trigger language plpgsql security definer
set
  search_path = '' as $$
declare
  v_from_world_id uuid;
  v_to_world_id uuid;
begin
  select world_id into v_from_world_id from public.nations where id = new.from_nation_id;
  select world_id into v_to_world_id from public.nations where id = new.to_nation_id;

  if v_from_world_id is distinct from v_to_world_id then
    raise exception 'nation_relationships: from_nation_id and to_nation_id must belong to the same world'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.check_nation_relationships_same_world ()
from
  public;

create trigger nation_relationships_same_world_check before insert
or
update on public.nation_relationships for each row
execute function public.check_nation_relationships_same_world ();
