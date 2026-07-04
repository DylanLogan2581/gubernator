-- Migration: guard_bilateral_relationship_propose
-- Fixes issue #954: proposeBilateral used to SELECT pending_status, check it
-- client-side, then upsert in a second round-trip. Two concurrent proposals
-- could both read the pre-accept state and overwrite an already-accepted
-- relationship (TOCTOU). This migration moves the guard into a BEFORE INSERT
-- OR UPDATE trigger that runs inside the same statement as the upsert, so
-- Postgres's row locking on the unique (from_nation_id, to_nation_id) index
-- serializes concurrent writers: the second writer's trigger invocation sees
-- the first writer's committed pending_status.
--
-- The same trigger resolves pending_changed_by_citizen_id server-side from
-- auth.uid() whenever a fresh proposal is written (pending_status =
-- 'proposed'), so the acting citizen can never be stale or client-spoofed.
-- Writes that are not proposals (accept/decline via respond_to_bilateral,
-- withdraw, or a unilateral-stance override) are left untouched — those
-- flows already clear or otherwise manage pending_changed_by_citizen_id
-- themselves.
-- ---------------------------------------------------------------------------
create or replace function public.guard_bilateral_relationship_propose () returns trigger language plpgsql security definer
set
  search_path = '' as $$
declare
  v_acting_citizen_id uuid;
begin
  if new.pending_status is distinct from 'proposed' then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.pending_status = 'accepted' then
    raise exception 'This proposal has already been accepted. Withdraw the existing agreement before proposing again.'
      using errcode = 'P0001';
  end if;

  select
    c.id into v_acting_citizen_id
  from
    public.citizens c
  where
    c.user_id = auth.uid ()
    and c.citizen_type = 'player_character'
    and c.role_type = 'nation_manager'
    and c.role_nation_id = new.from_nation_id
    and c.status = 'alive'
  limit
    1;

  new.pending_changed_by_citizen_id := v_acting_citizen_id;

  return new;
end;
$$;

revoke
execute on function public.guard_bilateral_relationship_propose ()
from
  public,
  anon;

create trigger nation_relationships_guard_propose before insert
or
update on public.nation_relationships for each row
execute function public.guard_bilateral_relationship_propose ();
