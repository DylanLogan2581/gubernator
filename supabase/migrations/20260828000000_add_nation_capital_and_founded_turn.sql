-- Migration: add_nation_capital_and_founded_turn
-- Adds nation identity: a capital settlement and a founding turn number.
-- Both columns are only writable through set_nation_capital_and_founded_turn,
-- a SECURITY DEFINER RPC gated by current_user_manages_nation (super admin,
-- world admin, or nation manager). Direct table UPDATE grants are left
-- untouched (name/description/is_hidden only), so these two new columns stay
-- unreachable through the browser table API, matching the
-- restrict_child_domain_writes pattern used for settlement readiness.
-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table public.nations
add column capital_settlement_id uuid references public.settlements (id) on delete set null,
add column founded_turn_number integer;

create index nations_capital_settlement_id_idx on public.nations (capital_settlement_id);

-- ---------------------------------------------------------------------------
-- 2. enforce_nation_capital_same_nation: guards nations.capital_settlement_id
-- so it can only reference a settlement that belongs to the nation itself.
-- ---------------------------------------------------------------------------
create or replace function public.enforce_nation_capital_same_nation () returns trigger language plpgsql as $$
begin
  if new.capital_settlement_id is not null then
    if not exists (
      select 1
      from public.settlements s
      where s.id = new.capital_settlement_id
        and s.nation_id = new.id
    ) then
      raise exception 'Capital settlement must belong to this nation.'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create trigger nations_enforce_capital_same_nation before insert
or
update of capital_settlement_id on public.nations for each row
execute function public.enforce_nation_capital_same_nation ();

-- ---------------------------------------------------------------------------
-- 3. clear_nation_capital_on_settlement_nation_change: when a settlement is
-- reassigned to a different nation, clear it as capital on the nation it
-- left. (Settlement deletion is handled by the capital_settlement_id FK's
-- own ON DELETE SET NULL and needs no trigger.)
-- ---------------------------------------------------------------------------
create or replace function public.clear_nation_capital_on_settlement_nation_change () returns trigger language plpgsql as $$
begin
  if new.nation_id is distinct from old.nation_id then
    update public.nations
    set capital_settlement_id = null
    where id = old.nation_id
      and capital_settlement_id = old.id;
  end if;

  return new;
end;
$$;

create trigger settlements_clear_nation_capital_on_nation_change
after
update of nation_id on public.settlements for each row
execute function public.clear_nation_capital_on_settlement_nation_change ();

-- ---------------------------------------------------------------------------
-- 4. set_nation_capital_and_founded_turn: writes capital_settlement_id and
-- founded_turn_number together. Authority: super admin, world admin, or
-- nation manager of this nation (current_user_manages_nation), same as the
-- existing manage-nation authority used elsewhere. Archived worlds are
-- read-only.
-- ---------------------------------------------------------------------------
create or replace function public.set_nation_capital_and_founded_turn (
  p_nation_id uuid,
  p_capital_settlement_id uuid,
  p_founded_turn_number integer
) returns setof public.nations language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
begin
  if p_nation_id is null then
    return;
  end if;

  select world_id into v_world_id
  from public.nations
  where id = p_nation_id;

  if v_world_id is null then
    return;
  end if;

  if not public.current_user_manages_nation (p_nation_id) then
    raise exception 'You do not have permission to manage this nation.'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  return query
  update public.nations
  set
    capital_settlement_id = p_capital_settlement_id,
    founded_turn_number = p_founded_turn_number
  where id = p_nation_id
  returning *;
end;
$$;

revoke all on function public.set_nation_capital_and_founded_turn (uuid, uuid, integer)
from
  public;

grant
execute on function public.set_nation_capital_and_founded_turn (uuid, uuid, integer) to authenticated;
