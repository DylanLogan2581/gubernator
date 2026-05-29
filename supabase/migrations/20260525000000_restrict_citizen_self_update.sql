-- Migration: restrict_citizen_self_update
-- Splits the combined citizens UPDATE policy into two targeted policies and
-- adds a BEFORE UPDATE trigger that enforces column-level restrictions on
-- the self-edit path.
--
-- citizens_update_admin  – Super Admin and World Admin keep full access to the
--                          column set already permitted by the column-level
--                          grants (role_* and user_id remain unreachable).
--
-- citizens_update_self   – A player_character may update their own row. The
--                          restrict_citizen_self_edit_columns trigger then
--                          enforces that protected columns (settlement_id,
--                          parent_a_citizen_id, parent_b_citizen_id, status,
--                          born_on_turn_number, death_cause) are unchanged,
--                          raising 42501 if any of them differ.
-- ---------------------------------------------------------------------------
drop policy if exists "citizens_update_admin_or_self" on public.citizens;

create policy "citizens_update_admin" on public.citizens
for update
  to authenticated using (
    public.is_super_admin ()
    or public.is_world_admin (world_id)
  )
with
  check (
    public.is_super_admin ()
    or public.is_world_admin (world_id)
  );

create policy "citizens_update_self" on public.citizens
for update
  to authenticated using (
    citizen_type = 'player_character'
    and user_id = public.current_app_user_id ()
  )
with
  check (
    citizen_type = 'player_character'
    and user_id = public.current_app_user_id ()
  );

-- ---------------------------------------------------------------------------
-- Trigger: restrict protected columns on browser-authenticated self-edits.
-- Mirrors the pattern used by restrict_user_self_service_update on the users
-- table. Super Admin and World Admin callers are excluded from the check so
-- their full-column updates (settlement relocation, lineage assignment, etc.)
-- continue to work.
-- ---------------------------------------------------------------------------
create or replace function public.restrict_citizen_self_edit_columns () returns trigger language plpgsql
set
  search_path = '' as $$
begin
  if current_role != 'authenticated' then
    return new;
  end if;

  if public.is_super_admin () or public.is_world_admin (old.world_id) then
    return new;
  end if;

  if
    old.settlement_id is distinct from new.settlement_id
    or old.parent_a_citizen_id is distinct from new.parent_a_citizen_id
    or old.parent_b_citizen_id is distinct from new.parent_b_citizen_id
    or old.status is distinct from new.status
    or old.born_on_turn_number is distinct from new.born_on_turn_number
    or old.death_cause is distinct from new.death_cause
  then
    raise exception 'permission denied: player characters may not change protected citizen columns'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger citizens_restrict_self_edit_columns before
update on public.citizens for each row
execute function public.restrict_citizen_self_edit_columns ();
