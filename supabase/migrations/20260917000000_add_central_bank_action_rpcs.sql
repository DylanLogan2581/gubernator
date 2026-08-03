-- Migration: add_central_bank_action_rpcs
-- #1093: the four core central bank actions on top of the currency schema
-- from #1092 (20260916000000_add_nation_currencies.sql) — mint_currency,
-- burn_currency, deposit_reserves, redeem_reserves. Authority for all four is
-- the same as establish_nation_currency: public.current_user_manages_nation
-- or the nation's bank_governor officeholder
-- (public.current_user_holds_nation_office). Every action appends a
-- turn-stamped row to the new nation_currency_ledger table for auditability.
--
-- Hard rules by currency type:
--   - resource_backed: money_supply is capped by reserve_quantity *
--     backing_ratio. mint_currency enforces the cap going up; redeem_reserves
--     enforces it going down (withdrawing reserves cannot leave money_supply
--     over capacity).
--   - fiat: mint_currency is uncapped here; the confidence penalty for
--     over-minting is simulation-phase work, not this RPC's concern.
--   - deposit_reserves / redeem_reserves are resource_backed only (fiat has
--     no reserve_quantity to move).
--
-- Row locking: every RPC locks the nation_currencies row first (FOR UPDATE),
-- then the nations row and/or nation_resource_stockpiles row as needed, in
-- that consistent order, to avoid lock-order deadlocks between concurrent
-- calls.
-- ---------------------------------------------------------------------------
-- 1. nation_currency_ledger
-- ---------------------------------------------------------------------------
create table public.nation_currency_ledger (
  id uuid primary key default gen_random_uuid(),
  currency_id uuid not null references public.nation_currencies (id) on delete cascade,
  action text not null check (action in ('mint', 'burn', 'deposit', 'redeem')),
  amount numeric,
  resource_amount numeric,
  actor_citizen_id uuid references public.citizens (id) on delete set null,
  turn_number integer not null,
  created_at timestamptz not null default now(),
  constraint nation_currency_ledger_amount_by_action_check check (
    (
      action in ('mint', 'burn')
      and amount is not null
      and amount > 0
      and resource_amount is null
    )
    or (
      action in ('deposit', 'redeem')
      and resource_amount is not null
      and resource_amount > 0
      and amount is null
    )
  ),
  constraint nation_currency_ledger_turn_number_check check (turn_number >= 0)
);

create index nation_currency_ledger_currency_id_idx on public.nation_currency_ledger (currency_id);

create index nation_currency_ledger_actor_citizen_id_idx on public.nation_currency_ledger (actor_citizen_id);

-- ---------------------------------------------------------------------------
-- RLS: SELECT where the ledger row's currency belongs to a nation visible to
-- the caller; writes only via the security-definer RPCs below.
-- ---------------------------------------------------------------------------
alter table public.nation_currency_ledger enable row level security;

create policy "nation_currency_ledger_select_visible" on public.nation_currency_ledger for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.nation_currencies nc
      where
        nc.id = nation_currency_ledger.currency_id
        and public.nation_visible_to_current_user (nc.nation_id)
    )
  );

grant
select
  on public.nation_currency_ledger to authenticated;

-- ---------------------------------------------------------------------------
-- 2. current_user_nation_currency_actor_citizen_id(p_nation_id): the citizen
-- id to record on a ledger row for the current caller, if any. Prefers the
-- bank_governor officeholder path, falling back to the nation_manager
-- player_character path; NULL when the caller is acting purely as a super
-- admin / world admin with no player_character in either role (the ledger
-- column is nullable for exactly this case).
-- ---------------------------------------------------------------------------
create or replace function public.current_user_nation_currency_actor_citizen_id (p_nation_id uuid) returns uuid language sql stable security definer
set
  search_path = '' as $$
  select coalesce(
    (
      select o.citizen_id
      from public.nation_offices o
      join public.citizens c on c.id = o.citizen_id
      where o.nation_id = p_nation_id
        and o.office_type = 'bank_governor'
        and c.user_id = auth.uid()
        and c.citizen_type = 'player_character'
        and c.status = 'alive'
      limit 1
    ),
    (
      select c.id
      from public.citizens c
      where c.role_type = 'nation_manager'
        and c.role_nation_id = p_nation_id
        and c.user_id = auth.uid()
        and c.citizen_type = 'player_character'
        and c.status = 'alive'
      limit 1
    )
  )
$$;

revoke all on function public.current_user_nation_currency_actor_citizen_id (uuid)
from
  public;

grant
execute on function public.current_user_nation_currency_actor_citizen_id (uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. mint_currency(p_currency_id, p_amount)
-- ---------------------------------------------------------------------------
create or replace function public.mint_currency (p_currency_id uuid, p_amount numeric) returns public.nation_currencies language plpgsql security definer
set
  search_path = '' as $$
declare
  v_currency public.nation_currencies%rowtype;
  v_world_id uuid;
  v_turn_number integer;
  v_cap numeric;
begin
  if p_currency_id is null or p_amount is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_amount <= 0 then
    raise exception 'p_amount must be positive' using errcode = '22023';
  end if;

  select nc.* into v_currency
  from public.nation_currencies nc
  where nc.id = p_currency_id
  for update;

  if v_currency.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select n.world_id, w.current_turn_number
  into v_world_id, v_turn_number
  from public.nations n
  join public.worlds w on w.id = n.world_id
  where n.id = v_currency.nation_id
  for update of n;

  if not (
    public.current_user_manages_nation (v_currency.nation_id)
    or public.current_user_holds_nation_office (v_currency.nation_id, 'bank_governor')
  ) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  if v_currency.currency_type = 'resource_backed' then
    v_cap := v_currency.reserve_quantity * v_currency.backing_ratio;

    if v_currency.money_supply + p_amount > v_cap then
      raise exception 'Insufficient reserves'
        using errcode = '22023', hint = 'insufficient_reserves';
    end if;
  end if;

  update public.nation_currencies
  set money_supply = money_supply + p_amount
  where id = p_currency_id
  returning * into v_currency;

  update public.nations
  set treasury_currency = treasury_currency + p_amount
  where id = v_currency.nation_id;

  insert into public.nation_currency_ledger (
    currency_id,
    action,
    amount,
    actor_citizen_id,
    turn_number
  )
  values (
    p_currency_id,
    'mint',
    p_amount,
    public.current_user_nation_currency_actor_citizen_id (v_currency.nation_id),
    v_turn_number
  );

  return v_currency;
end;
$$;

revoke all on function public.mint_currency (uuid, numeric)
from
  public;

grant
execute on function public.mint_currency (uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. burn_currency(p_currency_id, p_amount)
-- ---------------------------------------------------------------------------
create or replace function public.burn_currency (p_currency_id uuid, p_amount numeric) returns public.nation_currencies language plpgsql security definer
set
  search_path = '' as $$
declare
  v_currency public.nation_currencies%rowtype;
  v_world_id uuid;
  v_turn_number integer;
  v_treasury_currency numeric;
begin
  if p_currency_id is null or p_amount is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_amount <= 0 then
    raise exception 'p_amount must be positive' using errcode = '22023';
  end if;

  select nc.* into v_currency
  from public.nation_currencies nc
  where nc.id = p_currency_id
  for update;

  if v_currency.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select n.world_id, w.current_turn_number, n.treasury_currency
  into v_world_id, v_turn_number, v_treasury_currency
  from public.nations n
  join public.worlds w on w.id = n.world_id
  where n.id = v_currency.nation_id
  for update of n;

  if not (
    public.current_user_manages_nation (v_currency.nation_id)
    or public.current_user_holds_nation_office (v_currency.nation_id, 'bank_governor')
  ) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  if v_treasury_currency < p_amount then
    raise exception 'The treasury does not hold enough currency to burn'
      using errcode = '22023', hint = 'insufficient_treasury_currency';
  end if;

  update public.nations
  set treasury_currency = treasury_currency - p_amount
  where id = v_currency.nation_id;

  update public.nation_currencies
  set money_supply = money_supply - p_amount
  where id = p_currency_id
  returning * into v_currency;

  insert into public.nation_currency_ledger (
    currency_id,
    action,
    amount,
    actor_citizen_id,
    turn_number
  )
  values (
    p_currency_id,
    'burn',
    p_amount,
    public.current_user_nation_currency_actor_citizen_id (v_currency.nation_id),
    v_turn_number
  );

  return v_currency;
end;
$$;

revoke all on function public.burn_currency (uuid, numeric)
from
  public;

grant
execute on function public.burn_currency (uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. deposit_reserves(p_currency_id, p_quantity)
-- ---------------------------------------------------------------------------
create or replace function public.deposit_reserves (p_currency_id uuid, p_quantity numeric) returns public.nation_currencies language plpgsql security definer
set
  search_path = '' as $$
declare
  v_currency public.nation_currencies%rowtype;
  v_world_id uuid;
  v_turn_number integer;
  v_stockpile_quantity numeric(18, 4);
begin
  if p_currency_id is null or p_quantity is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_quantity <= 0 then
    raise exception 'p_quantity must be positive' using errcode = '22023';
  end if;

  select nc.* into v_currency
  from public.nation_currencies nc
  where nc.id = p_currency_id
  for update;

  if v_currency.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_currency.currency_type <> 'resource_backed' then
    raise exception 'deposit_reserves is only available for resource_backed currencies'
      using errcode = '22023', hint = 'fiat_currency_no_reserves';
  end if;

  select n.world_id, w.current_turn_number
  into v_world_id, v_turn_number
  from public.nations n
  join public.worlds w on w.id = n.world_id
  where n.id = v_currency.nation_id
  for update of n;

  if not (
    public.current_user_manages_nation (v_currency.nation_id)
    or public.current_user_holds_nation_office (v_currency.nation_id, 'bank_governor')
  ) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  select nrs.quantity into v_stockpile_quantity
  from public.nation_resource_stockpiles nrs
  where nrs.nation_id = v_currency.nation_id
    and nrs.resource_id = v_currency.backing_resource_id
  for update;

  v_stockpile_quantity := coalesce(v_stockpile_quantity, 0);

  if v_stockpile_quantity < p_quantity then
    raise exception 'The nation stockpile does not hold enough of the backing resource'
      using errcode = '22023', hint = 'insufficient_stockpile';
  end if;

  update public.nation_resource_stockpiles
  set quantity = quantity - p_quantity
  where nation_id = v_currency.nation_id
    and resource_id = v_currency.backing_resource_id;

  update public.nation_currencies
  set reserve_quantity = reserve_quantity + p_quantity
  where id = p_currency_id
  returning * into v_currency;

  insert into public.nation_currency_ledger (
    currency_id,
    action,
    resource_amount,
    actor_citizen_id,
    turn_number
  )
  values (
    p_currency_id,
    'deposit',
    p_quantity,
    public.current_user_nation_currency_actor_citizen_id (v_currency.nation_id),
    v_turn_number
  );

  return v_currency;
end;
$$;

revoke all on function public.deposit_reserves (uuid, numeric)
from
  public;

grant
execute on function public.deposit_reserves (uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. redeem_reserves(p_currency_id, p_quantity)
-- ---------------------------------------------------------------------------
create or replace function public.redeem_reserves (p_currency_id uuid, p_quantity numeric) returns public.nation_currencies language plpgsql security definer
set
  search_path = '' as $$
declare
  v_currency public.nation_currencies%rowtype;
  v_world_id uuid;
  v_turn_number integer;
  v_new_reserve_quantity numeric;
begin
  if p_currency_id is null or p_quantity is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_quantity <= 0 then
    raise exception 'p_quantity must be positive' using errcode = '22023';
  end if;

  select nc.* into v_currency
  from public.nation_currencies nc
  where nc.id = p_currency_id
  for update;

  if v_currency.id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_currency.currency_type <> 'resource_backed' then
    raise exception 'redeem_reserves is only available for resource_backed currencies'
      using errcode = '22023', hint = 'fiat_currency_no_reserves';
  end if;

  select n.world_id, w.current_turn_number
  into v_world_id, v_turn_number
  from public.nations n
  join public.worlds w on w.id = n.world_id
  where n.id = v_currency.nation_id
  for update of n;

  if not (
    public.current_user_manages_nation (v_currency.nation_id)
    or public.current_user_holds_nation_office (v_currency.nation_id, 'bank_governor')
  ) then
    raise exception 'insufficient privilege'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  if v_currency.reserve_quantity < p_quantity then
    raise exception 'The currency does not hold enough reserves to redeem'
      using errcode = '22023', hint = 'insufficient_reserves';
  end if;

  v_new_reserve_quantity := v_currency.reserve_quantity - p_quantity;

  if v_currency.money_supply > v_new_reserve_quantity * v_currency.backing_ratio then
    raise exception 'Would break backing — burn currency first'
      using errcode = '22023', hint = 'would_break_backing';
  end if;

  update public.nation_currencies
  set reserve_quantity = v_new_reserve_quantity
  where id = p_currency_id
  returning * into v_currency;

  insert into public.nation_resource_stockpiles (nation_id, resource_id, quantity)
  values (v_currency.nation_id, v_currency.backing_resource_id, p_quantity)
  on conflict (nation_id, resource_id)
  do update set quantity = public.nation_resource_stockpiles.quantity + p_quantity;

  insert into public.nation_currency_ledger (
    currency_id,
    action,
    resource_amount,
    actor_citizen_id,
    turn_number
  )
  values (
    p_currency_id,
    'redeem',
    p_quantity,
    public.current_user_nation_currency_actor_citizen_id (v_currency.nation_id),
    v_turn_number
  );

  return v_currency;
end;
$$;

revoke all on function public.redeem_reserves (uuid, numeric)
from
  public;

grant
execute on function public.redeem_reserves (uuid, numeric) to authenticated;
