-- Migration: add_nation_tax_policies_and_tribute
-- #1375: nation tax policy system + demand-tribute action.
--
-- Supersedes the single nations.tax_rate scalar with a configurable policy
-- model: a per-nation default rule plus optional per-settlement overrides,
-- each choosing a method (percent of production, percent of stockpile, or a
-- flat per-resource amount), a resource scope (all resources or a specific
-- list), a minimum-stockpile floor protecting settlements from being taxed
-- into starvation, and an outright exemption flag.
--
-- nations.tax_rate is kept (not dropped) so existing seeds, the treasury
-- slider, and the Nation display type keep working; it is now a convenience
-- mirror of the default percent-of-production rule, written by both the
-- policy RPCs below and the (updated) set_nation_tax_rate RPC. The simulation
-- national economy phase reads the policy rows, not the scalar.
--
-- Write access to nation_tax_policies is intentionally NOT exposed to
-- authenticated (no grants, no RLS write policies): rows are written only by
-- the SECURITY DEFINER RPCs below (gated by current_user_manages_nation),
-- matching the treasury-write posture. SELECT is open to world-access users.
-- ---------------------------------------------------------------------------
-- tax_method enum
-- ---------------------------------------------------------------------------
create type public.tax_method as enum('percent_production', 'percent_stockpile', 'flat');

-- ---------------------------------------------------------------------------
-- nation_tax_policies
-- settlement_id null  => the nation's default rule (one per nation).
-- settlement_id set   => a per-settlement override (one per settlement).
-- taxed_resource_ids null => applies to all resources; otherwise only the
-- listed resource ids are taxed.
-- ---------------------------------------------------------------------------
create table public.nation_tax_policies (
  id uuid primary key default gen_random_uuid(),
  nation_id uuid not null references public.nations (id) on delete cascade,
  settlement_id uuid references public.settlements (id) on delete cascade,
  method public.tax_method not null default 'percent_production',
  rate numeric(6, 4) not null default 0 check (
    rate >= 0
    and rate <= 1
  ),
  flat_amount numeric(18, 4) not null default 0 check (flat_amount >= 0),
  taxed_resource_ids uuid[],
  min_stockpile_floor numeric(18, 4) not null default 0 check (min_stockpile_floor >= 0),
  exempt boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One default rule per nation, one override per settlement.
create unique index nation_tax_policies_default_unique on public.nation_tax_policies (nation_id)
where
  settlement_id is null;

create unique index nation_tax_policies_settlement_unique on public.nation_tax_policies (nation_id, settlement_id)
where
  settlement_id is not null;

create index nation_tax_policies_nation_id_idx on public.nation_tax_policies (nation_id);

create index nation_tax_policies_settlement_id_idx on public.nation_tax_policies (settlement_id);

create trigger nation_tax_policies_set_updated_at before
update on public.nation_tax_policies for each row
execute function public.set_updated_at ();

alter table public.nation_tax_policies enable row level security;

-- SELECT: any user with world access may read tax policies, matching nation
-- stockpile visibility.
create policy "nation_tax_policies_select_world_access" on public.nation_tax_policies for
select
  to authenticated using (
    exists (
      select
        1
      from
        public.nations n
      where
        n.id = nation_tax_policies.nation_id
        and public.current_user_has_world_access (n.world_id)
    )
  );

-- No INSERT/UPDATE/DELETE policies for authenticated: rows are written only by
-- the SECURITY DEFINER RPCs below.
-- ---------------------------------------------------------------------------
-- Backfill: create a default percent-of-production rule for every existing
-- nation, carrying over its current tax_rate. Idempotent via the partial
-- unique index.
-- ---------------------------------------------------------------------------
insert into
  public.nation_tax_policies (nation_id, method, rate)
select
  n.id,
  'percent_production',
  n.tax_rate
from
  public.nations n
on conflict (nation_id)
where
  (settlement_id is null) do nothing;

-- ---------------------------------------------------------------------------
-- Seed trigger: nation INSERT => create its default tax rule from tax_rate.
-- SECURITY DEFINER so the trigger bypasses RLS regardless of who inserts.
-- ---------------------------------------------------------------------------
create or replace function public.seed_nation_default_tax_policy () returns trigger language plpgsql security definer
set
  search_path = '' as $$
begin
  insert into public.nation_tax_policies (nation_id, method, rate)
  values (new.id, 'percent_production', new.tax_rate)
  on conflict (nation_id) where (settlement_id is null) do nothing;

  return new;
end;
$$;

create trigger nations_seed_default_tax_policy
after insert on public.nations for each row
execute function public.seed_nation_default_tax_policy ();

revoke
execute on function public.seed_nation_default_tax_policy ()
from
  public,
  anon;

-- ---------------------------------------------------------------------------
-- RPC: upsert_nation_tax_policy
-- Upserts the default rule (p_settlement_id null) or a per-settlement override.
-- Gated by current_user_manages_nation; archived worlds are read-only. Keeps
-- nations.tax_rate in sync for the default percent-of-production rule.
-- ---------------------------------------------------------------------------
create or replace function public.upsert_nation_tax_policy (
  p_nation_id uuid,
  p_settlement_id uuid,
  p_method public.tax_method,
  p_rate numeric,
  p_flat_amount numeric,
  p_taxed_resource_ids uuid[],
  p_min_stockpile_floor numeric,
  p_exempt boolean
) returns setof public.nation_tax_policies language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_settlement_nation_id uuid;
begin
  if p_nation_id is null or p_method is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select world_id into v_world_id
  from public.nations
  where id = p_nation_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not public.current_user_manages_nation (p_nation_id) then
    raise exception 'You do not have permission to manage this nation.'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  if p_rate is not null and (p_rate < 0 or p_rate > 1) then
    raise exception 'rate must be between 0 and 1' using errcode = '22023';
  end if;

  if p_flat_amount is not null and p_flat_amount < 0 then
    raise exception 'flat_amount must be non-negative' using errcode = '22023';
  end if;

  if p_min_stockpile_floor is not null and p_min_stockpile_floor < 0 then
    raise exception 'min_stockpile_floor must be non-negative' using errcode = '22023';
  end if;

  -- A per-settlement override may only target a settlement of this nation.
  if p_settlement_id is not null then
    select nation_id into v_settlement_nation_id
    from public.settlements
    where id = p_settlement_id;

    if v_settlement_nation_id is null or v_settlement_nation_id <> p_nation_id then
      raise exception 'settlement % does not belong to nation %', p_settlement_id, p_nation_id
        using errcode = 'P0002';
    end if;
  end if;

  if p_settlement_id is null then
    insert into public.nation_tax_policies (
      nation_id, settlement_id, method, rate, flat_amount,
      taxed_resource_ids, min_stockpile_floor, exempt
    )
    values (
      p_nation_id, null, p_method, coalesce(p_rate, 0), coalesce(p_flat_amount, 0),
      p_taxed_resource_ids, coalesce(p_min_stockpile_floor, 0), coalesce(p_exempt, false)
    )
    on conflict (nation_id) where (settlement_id is null)
    do update set
      method = excluded.method,
      rate = excluded.rate,
      flat_amount = excluded.flat_amount,
      taxed_resource_ids = excluded.taxed_resource_ids,
      min_stockpile_floor = excluded.min_stockpile_floor,
      exempt = excluded.exempt;

    -- Mirror the default percent-of-production rate onto nations.tax_rate so
    -- the treasury slider and Nation display stay accurate (bounded to 0.5).
    update public.nations
    set tax_rate = case
      when p_method = 'percent_production' then least(coalesce(p_rate, 0), 0.5)
      else 0
    end
    where id = p_nation_id;
  else
    insert into public.nation_tax_policies (
      nation_id, settlement_id, method, rate, flat_amount,
      taxed_resource_ids, min_stockpile_floor, exempt
    )
    values (
      p_nation_id, p_settlement_id, p_method, coalesce(p_rate, 0), coalesce(p_flat_amount, 0),
      p_taxed_resource_ids, coalesce(p_min_stockpile_floor, 0), coalesce(p_exempt, false)
    )
    on conflict (nation_id, settlement_id) where (settlement_id is not null)
    do update set
      method = excluded.method,
      rate = excluded.rate,
      flat_amount = excluded.flat_amount,
      taxed_resource_ids = excluded.taxed_resource_ids,
      min_stockpile_floor = excluded.min_stockpile_floor,
      exempt = excluded.exempt;
  end if;

  return query
  select *
  from public.nation_tax_policies
  where nation_id = p_nation_id
    and settlement_id is not distinct from p_settlement_id;
end;
$$;

revoke all on function public.upsert_nation_tax_policy (
  uuid,
  uuid,
  public.tax_method,
  numeric,
  numeric,
  uuid[],
  numeric,
  boolean
)
from
  public;

grant
execute on function public.upsert_nation_tax_policy (
  uuid,
  uuid,
  public.tax_method,
  numeric,
  numeric,
  uuid[],
  numeric,
  boolean
) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: delete_nation_tax_policy
-- Removes a per-settlement override (the default rule cannot be deleted).
-- ---------------------------------------------------------------------------
create or replace function public.delete_nation_tax_policy (p_nation_id uuid, p_settlement_id uuid) returns void language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
begin
  if p_nation_id is null or p_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select world_id into v_world_id
  from public.nations
  where id = p_nation_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not public.current_user_manages_nation (p_nation_id) then
    raise exception 'You do not have permission to manage this nation.'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  delete from public.nation_tax_policies
  where nation_id = p_nation_id
    and settlement_id = p_settlement_id;
end;
$$;

revoke all on function public.delete_nation_tax_policy (uuid, uuid)
from
  public;

grant
execute on function public.delete_nation_tax_policy (uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: demand_tribute
-- One-time seizure: pulls the requested resources directly from a settlement
-- stockpile into the demanding nation's treasury, clamped to what the
-- settlement actually holds (never negative). Emits a notification to the
-- affected settlement's managers (or world admins) so the seizure is not
-- silent. p_items is a jsonb array of { "resource_id": uuid, "quantity": num }.
-- Authority: the caller must manage the demanding nation p_nation_id.
-- ---------------------------------------------------------------------------
create or replace function public.demand_tribute (
  p_nation_id uuid,
  p_settlement_id uuid,
  p_items jsonb
) returns table (
  resource_id uuid,
  seized_quantity numeric,
  clamped boolean
) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_settlement_world_id uuid;
  v_settlement_nation_id uuid;
  v_item jsonb;
  v_resource_id uuid;
  v_requested numeric;
  v_available numeric(18, 4);
  v_transfer numeric(18, 4);
  v_any_transfer boolean := false;
  v_recipient_count integer;
begin
  if p_nation_id is null or p_settlement_id is null or p_items is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'p_items must be a json array' using errcode = '22023';
  end if;

  select world_id into v_world_id
  from public.nations
  where id = p_nation_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not public.current_user_manages_nation (p_nation_id) then
    raise exception 'You do not have permission to manage this nation.'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  select s.nation_id, n.world_id
  into v_settlement_nation_id, v_settlement_world_id
  from public.settlements s
  join public.nations n on n.id = s.nation_id
  where s.id = p_settlement_id;

  if v_settlement_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_settlement_world_id <> v_world_id then
    raise exception 'settlement % is not in the same world as nation %', p_settlement_id, p_nation_id
      using errcode = 'P0002';
  end if;

  for v_item in select * from jsonb_array_elements(p_items)
  loop
    v_resource_id := (v_item ->> 'resource_id')::uuid;
    v_requested := (v_item ->> 'quantity')::numeric;

    if v_resource_id is null or v_requested is null or v_requested <= 0 then
      continue;
    end if;

    -- Lock the settlement stockpile row so concurrent seizures cannot both
    -- read the same "available" amount.
    select srs.quantity into v_available
    from public.settlement_resource_stockpiles srs
    where srs.settlement_id = p_settlement_id
      and srs.resource_id = v_resource_id
    for update;

    v_available := coalesce(v_available, 0);
    v_transfer := greatest(least(v_requested, v_available), 0);

    resource_id := v_resource_id;
    seized_quantity := v_transfer;
    clamped := v_transfer < v_requested;

    if v_transfer > 0 then
      v_any_transfer := true;

      update public.settlement_resource_stockpiles srs
      set quantity = srs.quantity - v_transfer
      where srs.settlement_id = p_settlement_id
        and srs.resource_id = v_resource_id;

      insert into public.nation_resource_stockpiles (nation_id, resource_id, quantity)
      values (p_nation_id, v_resource_id, v_transfer)
      on conflict on constraint nation_resource_stockpiles_nation_resource_unique
      do update set quantity = public.nation_resource_stockpiles.quantity + v_transfer;
    end if;

    return next;
  end loop;

  -- Notify the affected settlement's managers (falling back to world admins)
  -- so the seizure is not silent.
  if v_any_transfer then
    select count(*) into v_recipient_count
    from public.citizens c
    where c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and (
        (c.role_type = 'nation_manager' and c.role_nation_id = v_settlement_nation_id)
        or (c.role_type = 'settlement_manager' and c.role_settlement_id = p_settlement_id)
      );

    with
      settlement_recipients as (
        select c.user_id
        from public.citizens c
        where v_recipient_count > 0
          and c.status = 'alive'
          and c.citizen_type = 'player_character'
          and c.user_id is not null
          and (
            (c.role_type = 'nation_manager' and c.role_nation_id = v_settlement_nation_id)
            or (c.role_type = 'settlement_manager' and c.role_settlement_id = p_settlement_id)
          )
      ),
      world_admin_users as (
        select wa.user_id
        from public.world_admins wa
        join public.users u on u.id = wa.user_id
        where wa.world_id = v_settlement_world_id
          and u.status = 'active'
      ),
      all_recipients as (
        select user_id from settlement_recipients
        union
        select user_id from world_admin_users where v_recipient_count = 0
      )
    insert into public.notifications (
      recipient_user_id,
      world_id,
      nation_id,
      settlement_id,
      notification_type,
      message_text
    )
    select
      ar.user_id,
      v_settlement_world_id,
      v_settlement_nation_id,
      p_settlement_id,
      'nation.tribute_demanded',
      'A tribute of resources was seized from this settlement''s stockpile.'
    from all_recipients ar;
  end if;

  return;
end;
$$;

revoke all on function public.demand_tribute (uuid, uuid, jsonb)
from
  public;

grant
execute on function public.demand_tribute (uuid, uuid, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- Update set_nation_tax_rate: keep updating nations.tax_rate (for the treasury
-- slider / display), and additionally upsert the nation's default tax rule so
-- the simulation — which now reads policy rows — honors the slider.
-- ---------------------------------------------------------------------------
create or replace function public.set_nation_tax_rate (p_nation_id uuid, p_rate numeric) returns setof public.nations language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
begin
  if p_nation_id is null or p_rate is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select world_id into v_world_id
  from public.nations
  where id = p_nation_id;

  if v_world_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not public.current_user_manages_nation (p_nation_id) then
    raise exception 'You do not have permission to manage this nation.'
      using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.'
      using errcode = '22023';
  end if;

  insert into public.nation_tax_policies (nation_id, method, rate)
  values (p_nation_id, 'percent_production', p_rate)
  on conflict (nation_id) where (settlement_id is null)
  do update set method = 'percent_production', rate = excluded.rate;

  return query
  update public.nations
  set tax_rate = p_rate
  where id = p_nation_id
  returning *;
end;
$$;
