-- Migration: add_user_active_player_characters
-- Adds the server-side mapping from (user_id, world_id) to the user's
-- currently-active player_character citizen in that world. This persists the
-- active character selection so a user resuming on a different device picks up
-- the same citizen. Client-side localStorage is intentionally not used.
--
-- Validation chains through citizens via a trigger: the referenced citizen
-- must be a player_character whose user_id matches the row's user_id and
-- whose world_id matches the row's world_id, and the citizen must still be
-- alive. The trigger runs both on writes to this table and as an after-update
-- on citizens to clear the row when a player character dies or is unlinked
-- from its user; an ON DELETE CASCADE on citizen_id handles citizen deletion.
--
-- RLS limits both reads and writes to the row's own user_id. Super admins get
-- a read-only path for support purposes; super admin writes are deliberately
-- not allowed so a support operator cannot silently change which character a
-- user resumes as.
-- ---------------------------------------------------------------------------
-- user_active_player_characters
-- ---------------------------------------------------------------------------
create table public.user_active_player_characters (
  user_id uuid not null references public.users (id) on delete cascade,
  world_id uuid not null references public.worlds (id) on delete cascade,
  citizen_id uuid not null references public.citizens (id) on delete cascade,
  updated_at timestamptz not null default now(),
  constraint user_active_player_characters_pkey primary key (user_id, world_id)
);

create index user_active_player_characters_citizen_idx on public.user_active_player_characters (citizen_id);

create trigger user_active_player_characters_set_updated_at before
update on public.user_active_player_characters for each row
execute function public.set_updated_at ();

alter table public.user_active_player_characters enable row level security;

-- ---------------------------------------------------------------------------
-- Validation trigger: ensure the chosen citizen is a living player_character
-- linked to the same user and in the same world as the row. SECURITY DEFINER
-- so the lookup against citizens is not blocked by that table's RLS policies;
-- the trigger only runs as part of an authenticated write to a row already
-- gated by user_active_player_characters RLS.
-- ---------------------------------------------------------------------------
create or replace function public.user_active_player_characters_validate () returns trigger language plpgsql security definer
set
  search_path = '' as $$
declare
  v_citizen public.citizens%rowtype;
begin
  select * into v_citizen
  from public.citizens
  where id = new.citizen_id;

  if not found then
    raise exception 'citizen % not found', new.citizen_id
      using errcode = 'foreign_key_violation';
  end if;

  if v_citizen.citizen_type <> 'player_character' then
    raise exception 'citizen % is not a player character', new.citizen_id
      using errcode = 'check_violation';
  end if;

  if v_citizen.user_id is null or v_citizen.user_id <> new.user_id then
    raise exception 'citizen % is not linked to user %', new.citizen_id, new.user_id
      using errcode = 'check_violation';
  end if;

  if v_citizen.world_id <> new.world_id then
    raise exception 'citizen % does not belong to world %', new.citizen_id, new.world_id
      using errcode = 'check_violation';
  end if;

  if v_citizen.status <> 'alive' then
    raise exception 'citizen % is not alive', new.citizen_id
      using errcode = 'check_violation';
  end if;

  return new;
end
$$;

revoke all on function public.user_active_player_characters_validate ()
from
  public;

create trigger user_active_player_characters_validate_trg before insert
or
update on public.user_active_player_characters for each row
execute function public.user_active_player_characters_validate ();

-- ---------------------------------------------------------------------------
-- Cleanup trigger on citizens: when a player character dies, is unlinked
-- from its user, or is converted to an npc, drop any active-PC row that
-- pointed at it so the next entry into the world re-runs the selection
-- logic. Plain deletion of the citizen is handled by ON DELETE CASCADE.
-- SECURITY DEFINER so the cleanup is not blocked by user_active_player_characters RLS.
-- ---------------------------------------------------------------------------
create or replace function public.citizens_clear_active_player_character () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  if (
    old.citizen_type = 'player_character'
    and (
      new.status <> old.status and new.status <> 'alive'
      or new.user_id is distinct from old.user_id
      or new.citizen_type <> old.citizen_type
    )
  ) then
    delete from public.user_active_player_characters
    where citizen_id = old.id;
  end if;

  return new;
end
$$;

revoke all on function public.citizens_clear_active_player_character ()
from
  public;

create trigger citizens_clear_active_player_character_trg
after
update on public.citizens for each row
execute function public.citizens_clear_active_player_character ();

-- ---------------------------------------------------------------------------
-- RLS policies
-- ---------------------------------------------------------------------------
-- Read: the row's own user, or super admins (for support).
create policy "user_active_player_characters_select_own_or_super_admin" on public.user_active_player_characters for
select
  to authenticated using (
    user_id = public.current_app_user_id ()
    or public.is_super_admin ()
  );

-- Writes: only the row's own user. Super admin writes are intentionally not
-- permitted so support cannot silently change a user's active character.
create policy "user_active_player_characters_insert_own" on public.user_active_player_characters for insert to authenticated
with
  check (user_id = public.current_app_user_id ());

create policy "user_active_player_characters_update_own" on public.user_active_player_characters
for update
  to authenticated using (user_id = public.current_app_user_id ())
with
  check (user_id = public.current_app_user_id ());

create policy "user_active_player_characters_delete_own" on public.user_active_player_characters for delete to authenticated using (user_id = public.current_app_user_id ());
