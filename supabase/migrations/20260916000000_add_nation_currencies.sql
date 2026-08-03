-- Migration: add_nation_currencies
-- #1092: nation currency schema + establish-currency RPC. Worlds start
-- currencyless (barter); a nation manager or its bank_governor officeholder
-- can establish one currency per nation, either fiat or resource_backed.
-- Mint/burn/reserve actions land in the central bank actions issue;
-- confidence dynamics land in the currency simulation issue — this migration
-- only creates the row and its invariants.
-- ---------------------------------------------------------------------------
-- 1. nations.treasury_currency: the nation government's own currency
-- holdings. Included in money_supply, tracked separately here so it can be
-- spent by treasury RPCs without touching nation_currencies directly.
-- ---------------------------------------------------------------------------
alter table public.nations
add column treasury_currency numeric not null default 0 check (treasury_currency >= 0);

-- ---------------------------------------------------------------------------
-- 2. nation_currencies
-- ---------------------------------------------------------------------------
create table public.nation_currencies (
  id uuid primary key default gen_random_uuid(),
  world_id uuid not null references public.worlds (id) on delete cascade,
  nation_id uuid not null references public.nations (id) on delete cascade,
  name text not null,
  symbol text not null,
  currency_type text not null check (currency_type in ('fiat', 'resource_backed')),
  backing_resource_id uuid references public.resources (id) on delete restrict,
  backing_ratio numeric,
  money_supply numeric not null default 0,
  reserve_quantity numeric not null default 0,
  confidence numeric not null default 1,
  established_turn_number integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint nation_currencies_nation_unique unique (nation_id),
  constraint nation_currencies_name_length_check check (char_length(btrim(name)) >= 1),
  constraint nation_currencies_symbol_length_check check (char_length(symbol) between 1 and 5),
  constraint nation_currencies_backing_ratio_check check (
    backing_ratio is null
    or backing_ratio > 0
  ),
  constraint nation_currencies_money_supply_check check (money_supply >= 0),
  constraint nation_currencies_reserve_quantity_check check (reserve_quantity >= 0),
  constraint nation_currencies_confidence_check check (confidence between 0 and 1),
  constraint nation_currencies_established_turn_number_check check (established_turn_number >= 0),
  constraint nation_currencies_backing_fields_by_type_check check (
    (
      currency_type = 'resource_backed'
      and backing_resource_id is not null
      and backing_ratio is not null
    )
    or (
      currency_type = 'fiat'
      and backing_resource_id is null
      and backing_ratio is null
    )
  )
);

create index nation_currencies_world_id_idx on public.nation_currencies (world_id);

create index nation_currencies_backing_resource_id_idx on public.nation_currencies (backing_resource_id);

create trigger nation_currencies_set_updated_at before
update on public.nation_currencies for each row
execute function public.set_updated_at ();

-- ---------------------------------------------------------------------------
-- 3. RLS: SELECT where the nation is visible to the caller (discovery
-- helper); writes only via the security-definer RPC below.
-- ---------------------------------------------------------------------------
alter table public.nation_currencies enable row level security;

create policy "nation_currencies_select_visible" on public.nation_currencies for
select
  to authenticated using (public.nation_visible_to_current_user (nation_id));

grant
select
  on public.nation_currencies to authenticated;

-- ---------------------------------------------------------------------------
-- 4. current_user_holds_nation_office(p_nation_id, p_office_type): TRUE when
-- the caller controls a living player_character holding that office in the
-- nation. Reused by the establish-currency RPC's bank_governor path and by
-- future central-bank-action RPCs that gate on the same office.
-- ---------------------------------------------------------------------------
create or replace function public.current_user_holds_nation_office (p_nation_id uuid, p_office_type text) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select exists (
    select 1
    from public.nation_offices o
    join public.citizens c on c.id = o.citizen_id
    where o.nation_id = p_nation_id
      and o.office_type = p_office_type
      and c.user_id = auth.uid()
      and c.citizen_type = 'player_character'
      and c.status = 'alive'
  )
$$;

-- ---------------------------------------------------------------------------
-- 5. establish_nation_currency: caller must be the nation's manager (super
-- admin, world admin, or nation_manager citizen) or its bank_governor
-- officeholder. One currency per nation (unique_violation -> friendly
-- error). resource_backed requires a valid, non-trashed resource in the same
-- world; fiat forbids the backing fields (table check is the backstop).
-- ---------------------------------------------------------------------------
create or replace function public.establish_nation_currency (
  p_nation_id uuid,
  p_name text,
  p_symbol text,
  p_type text,
  p_backing_resource_id uuid default null,
  p_backing_ratio numeric default null
) returns public.nation_currencies language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_world_status text;
  v_turn_number integer;
  v_resource_world_id uuid;
  v_resource_is_trashed boolean;
  v_row public.nation_currencies%rowtype;
begin
  if p_nation_id is null or p_name is null or p_symbol is null or p_type is null then
    raise exception 'nation, name, symbol, and type are required'
      using errcode = '22023';
  end if;

  select n.world_id, w.status, w.current_turn_number
  into v_world_id, v_world_status, v_turn_number
  from public.nations n
  inner join public.worlds w on w.id = n.world_id
  where n.id = p_nation_id;

  if v_world_id is null then
    raise exception 'nation not found'
      using errcode = 'P0002';
  end if;

  if v_world_status = 'archived' then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023', hint = 'world_archived';
  end if;

  if not (
    public.current_user_manages_nation (p_nation_id)
    or public.current_user_holds_nation_office (p_nation_id, 'bank_governor')
  ) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  if p_type not in ('fiat', 'resource_backed') then
    raise exception 'currency type must be fiat or resource_backed'
      using errcode = '22023', hint = 'invalid_currency_type';
  end if;

  if p_type = 'resource_backed' then
    if p_backing_resource_id is null or p_backing_ratio is null then
      raise exception 'resource_backed currencies require a backing resource and ratio'
        using errcode = '22023', hint = 'backing_fields_required';
    end if;

    select r.world_id, r.is_trashed
    into v_resource_world_id, v_resource_is_trashed
    from public.resources r
    where r.id = p_backing_resource_id;

    if v_resource_world_id is null or v_resource_world_id <> v_world_id or v_resource_is_trashed then
      raise exception 'backing resource not found'
        using errcode = 'P0002', hint = 'backing_resource_not_found';
    end if;
  else
    if p_backing_resource_id is not null or p_backing_ratio is not null then
      raise exception 'fiat currencies cannot have backing resource or ratio'
        using errcode = '22023', hint = 'backing_fields_forbidden';
    end if;
  end if;

  begin
    insert into public.nation_currencies (
      world_id,
      nation_id,
      name,
      symbol,
      currency_type,
      backing_resource_id,
      backing_ratio,
      established_turn_number
    )
    values (
      v_world_id,
      p_nation_id,
      p_name,
      p_symbol,
      p_type,
      p_backing_resource_id,
      p_backing_ratio,
      v_turn_number
    )
    returning * into v_row;
  exception
    when unique_violation then
      raise exception 'this nation already has a currency'
        using errcode = '23505', hint = 'currency_already_established';
  end;

  return v_row;
end;
$$;

revoke all on function public.establish_nation_currency (uuid, text, text, text, uuid, numeric)
from
  public;

grant
execute on function public.establish_nation_currency (uuid, text, text, text, uuid, numeric) to authenticated;
