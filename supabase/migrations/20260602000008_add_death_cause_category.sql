-- Migration: add_death_cause_category
-- Introduces the death_cause_category enum and adds it as a paired column on
-- citizens so that simulation reports can filter by cause bucket without
-- parsing the free-text death_cause detail. Enforces a CHECK that keeps the
-- two death columns consistent with the citizen's status. Adds the
-- mark_citizen_dead admin RPC which is the only authorised path for writing
-- this column from client code.
-- ---------------------------------------------------------------------------
-- Enum
-- ---------------------------------------------------------------------------
create type public.death_cause_category as enum(
  'starvation',
  'homeless',
  'event',
  'manual_admin',
  'unknown'
);

-- ---------------------------------------------------------------------------
-- Column (nullable until backfill)
-- ---------------------------------------------------------------------------
alter table public.citizens
add column death_cause_category public.death_cause_category;

-- Backfill: existing dead citizens get 'unknown' so the pair check below can
-- be added as a validated constraint.
update public.citizens
set
  death_cause_category = 'unknown'
where
  status = 'dead';

-- ---------------------------------------------------------------------------
-- Pair CHECK
-- ---------------------------------------------------------------------------
alter table public.citizens
add constraint citizens_death_cause_pair_check check (
  (
    status = 'alive'
    and death_cause_category is null
    and death_cause is null
  )
  or (
    status = 'dead'
    and death_cause_category is not null
  )
);

-- death_cause_category is intentionally excluded from the column-level grants
-- for authenticated. Engine and admin RPCs are the only writers (they are
-- SECURITY DEFINER and bypass column-level checks). No explicit revoke is
-- needed because the existing grant lists are exhaustive: any column not
-- named there is already unreachable through the table API.
-- ---------------------------------------------------------------------------
-- Trigger update: protect death_cause_category from player-character self-edits
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
    or old.death_cause_category is distinct from new.death_cause_category
  then
    raise exception 'permission denied: player characters may not change protected citizen columns'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- mark_citizen_dead: admin RPC that writes both death columns atomically.
-- Returns the updated citizen row, or an empty result set on any guard
-- failure (unknown citizen, insufficient permission, archived world, citizen
-- already dead).
-- ---------------------------------------------------------------------------
create or replace function public.mark_citizen_dead (p_citizen_id uuid, p_reason text) returns setof public.citizens language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_status text;
begin
  select c.world_id, c.status
    into v_world_id, v_status
    from public.citizens c
   where c.id = p_citizen_id;

  if v_world_id is null then
    return;
  end if;

  if not (public.is_super_admin () or public.is_world_admin (v_world_id)) then
    return;
  end if;

  if exists (
    select 1
      from public.worlds w
     where w.id = v_world_id
       and (w.status = 'archived' or w.archived_at is not null)
  ) then
    return;
  end if;

  if v_status = 'dead' then
    return;
  end if;

  return query
  update public.citizens
     set status               = 'dead',
         death_cause_category = 'manual_admin',
         death_cause          = nullif (btrim (coalesce (p_reason, '')), '')
   where id = p_citizen_id
   returning *;
end;
$$;

revoke all on function public.mark_citizen_dead (uuid, text)
from
  public;

grant
execute on function public.mark_citizen_dead (uuid, text) to authenticated;
