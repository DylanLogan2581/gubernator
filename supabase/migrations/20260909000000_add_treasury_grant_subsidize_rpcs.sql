-- Migration: add_treasury_grant_subsidize_rpcs
-- #1084: first two treasury spends. Both RPCs move stock from a nation's
-- stockpile into a settlement's stockpile, clamped to (a) what the nation
-- actually holds and (b) the settlement's remaining storage space
-- (public.settlement_effective_storage_cap, added 20260602000006). Neither
-- ever drives a stockpile negative — the nation_resource_stockpiles /
-- settlement_resource_stockpiles quantity >= 0 checks are a hard backstop
-- behind the clamping done here.
--
-- Authority: public.current_user_manages_nation (super admin, world admin, or
-- the nation's own nation_manager citizen) — same gate as set_nation_tax_rate.
--
-- Logging: turn_log_entries.turn_transition_id is NOT NULL and FK'd to
-- turn_transitions, so out-of-transition RPCs cannot write to it (there is no
-- open transition to attach to). Per the issue's own fallback, both RPCs emit
-- a notification to nation members instead, following the propose_trade_route
-- recipient-resolution pattern (nation/settlement managers, falling back to
-- world admins if none).
-- ---------------------------------------------------------------------------
-- grant_nation_resources
-- ---------------------------------------------------------------------------
create or replace function public.grant_nation_resources (
  p_nation_id uuid,
  p_settlement_id uuid,
  p_resource_id uuid,
  p_quantity numeric,
  out granted_quantity numeric,
  out clamped boolean
) returns record language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_settlement_nation_id uuid;
  v_nation_available numeric(18, 4);
  v_settlement_quantity numeric(18, 4);
  v_settlement_cap numeric;
  v_room numeric;
  v_transfer numeric(18, 4);
  v_recipient_count integer;
begin
  if p_nation_id is null or p_settlement_id is null or p_resource_id is null or p_quantity is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if p_quantity <= 0 then
    raise exception 'p_quantity must be positive' using errcode = '22023';
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

  select nation_id into v_settlement_nation_id
  from public.settlements
  where id = p_settlement_id;

  if v_settlement_nation_id is null or v_settlement_nation_id <> p_nation_id then
    raise exception 'settlement % does not belong to nation %', p_settlement_id, p_nation_id
      using errcode = 'P0002';
  end if;

  -- Lock the nation stockpile row so concurrent grants against the same
  -- resource cannot both read the same "available" amount.
  select quantity into v_nation_available
  from public.nation_resource_stockpiles
  where nation_id = p_nation_id
    and resource_id = p_resource_id
  for update;

  v_nation_available := coalesce(v_nation_available, 0);

  select quantity into v_settlement_quantity
  from public.settlement_resource_stockpiles
  where settlement_id = p_settlement_id
    and resource_id = p_resource_id
  for update;

  v_settlement_quantity := coalesce(v_settlement_quantity, 0);

  v_settlement_cap := public.settlement_effective_storage_cap (p_settlement_id, p_resource_id);
  v_room := greatest(v_settlement_cap - v_settlement_quantity, 0);

  v_transfer := least(p_quantity, v_nation_available, v_room);
  v_transfer := greatest(v_transfer, 0);

  granted_quantity := v_transfer;
  clamped := v_transfer < p_quantity;

  if v_transfer > 0 then
    update public.nation_resource_stockpiles
    set quantity = quantity - v_transfer
    where nation_id = p_nation_id
      and resource_id = p_resource_id;

    insert into public.settlement_resource_stockpiles (settlement_id, resource_id, quantity)
    values (p_settlement_id, p_resource_id, v_transfer)
    on conflict (settlement_id, resource_id)
    do update set quantity = public.settlement_resource_stockpiles.quantity + v_transfer;

    select count(*) into v_recipient_count
    from public.citizens c
    where c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and (
        (c.role_type = 'nation_manager' and c.role_nation_id = p_nation_id)
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
            (c.role_type = 'nation_manager' and c.role_nation_id = p_nation_id)
            or (c.role_type = 'settlement_manager' and c.role_settlement_id = p_settlement_id)
          )
      ),
      world_admin_users as (
        select wa.user_id
        from public.world_admins wa
        join public.users u on u.id = wa.user_id
        where wa.world_id = v_world_id
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
      v_world_id,
      p_nation_id,
      p_settlement_id,
      'nation.grant_received',
      'The nation treasury granted resources to this settlement.'
    from all_recipients ar;
  end if;
end;
$$;

revoke all on function public.grant_nation_resources (uuid, uuid, uuid, numeric)
from
  public;

grant
execute on function public.grant_nation_resources (uuid, uuid, uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- subsidize_construction_project
-- v1: transfers the full construction_costs_json amount (per resource) for
-- the project's target tier from the nation stockpile into the project's
-- settlement stockpile, clamped exactly like grant_nation_resources. There is
-- no "remaining inputs" tracking on construction_projects today (progress is
-- worker-turn based, not resource-input based), so "required remaining input
-- resources" reduces to "the tier's full construction_costs_json" in v1.
-- ---------------------------------------------------------------------------
create or replace function public.subsidize_construction_project (p_nation_id uuid, p_project_id uuid) returns table (
  resource_id uuid,
  granted_quantity numeric,
  clamped boolean
) language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id uuid;
  v_settlement_id uuid;
  v_settlement_nation_id uuid;
  v_target_tier_id uuid;
  v_cost jsonb;
  v_cost_resource_id uuid;
  v_cost_amount numeric;
  v_nation_available numeric(18, 4);
  v_settlement_quantity numeric(18, 4);
  v_settlement_cap numeric;
  v_room numeric;
  v_transfer numeric(18, 4);
  v_any_transfer boolean := false;
  v_recipient_count integer;
begin
  if p_nation_id is null or p_project_id is null then
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

  select cp.settlement_id, cp.target_tier_id, s.nation_id
  into v_settlement_id, v_target_tier_id, v_settlement_nation_id
  from public.construction_projects cp
  join public.settlements s on s.id = cp.settlement_id
  where cp.id = p_project_id;

  if v_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_settlement_nation_id <> p_nation_id then
    raise exception 'project % does not belong to nation %', p_project_id, p_nation_id
      using errcode = 'P0002';
  end if;

  for v_cost in
    select value
    from public.building_blueprint_tiers t
    cross join lateral jsonb_array_elements(t.construction_costs_json) as value
    where t.id = v_target_tier_id
  loop
    v_cost_resource_id := (v_cost ->> 'resource_id')::uuid;
    v_cost_amount := (v_cost ->> 'amount')::numeric;

    if v_cost_resource_id is null or v_cost_amount is null or v_cost_amount <= 0 then
      continue;
    end if;

    select nrs.quantity into v_nation_available
    from public.nation_resource_stockpiles nrs
    where nrs.nation_id = p_nation_id
      and nrs.resource_id = v_cost_resource_id
    for update;

    v_nation_available := coalesce(v_nation_available, 0);

    select srs.quantity into v_settlement_quantity
    from public.settlement_resource_stockpiles srs
    where srs.settlement_id = v_settlement_id
      and srs.resource_id = v_cost_resource_id
    for update;

    v_settlement_quantity := coalesce(v_settlement_quantity, 0);

    v_settlement_cap := public.settlement_effective_storage_cap (v_settlement_id, v_cost_resource_id);
    v_room := greatest(v_settlement_cap - v_settlement_quantity, 0);

    v_transfer := greatest(least(v_cost_amount, v_nation_available, v_room), 0);

    resource_id := v_cost_resource_id;
    granted_quantity := v_transfer;
    clamped := v_transfer < v_cost_amount;

    if v_transfer > 0 then
      v_any_transfer := true;

      update public.nation_resource_stockpiles nrs
      set quantity = nrs.quantity - v_transfer
      where nrs.nation_id = p_nation_id
        and nrs.resource_id = v_cost_resource_id;

      insert into public.settlement_resource_stockpiles (settlement_id, resource_id, quantity)
      values (v_settlement_id, v_cost_resource_id, v_transfer)
      on conflict on constraint settlement_resource_stockpiles_settlement_resource_unique
      do update set quantity = public.settlement_resource_stockpiles.quantity + v_transfer;
    end if;

    return next;
  end loop;

  if v_any_transfer then
    select count(*) into v_recipient_count
    from public.citizens c
    where c.status = 'alive'
      and c.citizen_type = 'player_character'
      and c.user_id is not null
      and (
        (c.role_type = 'nation_manager' and c.role_nation_id = p_nation_id)
        or (c.role_type = 'settlement_manager' and c.role_settlement_id = v_settlement_id)
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
            (c.role_type = 'nation_manager' and c.role_nation_id = p_nation_id)
            or (c.role_type = 'settlement_manager' and c.role_settlement_id = v_settlement_id)
          )
      ),
      world_admin_users as (
        select wa.user_id
        from public.world_admins wa
        join public.users u on u.id = wa.user_id
        where wa.world_id = v_world_id
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
      v_world_id,
      p_nation_id,
      v_settlement_id,
      'nation.subsidy_received',
      'The nation treasury subsidized a construction project in this settlement.'
    from all_recipients ar;
  end if;

  return;
end;
$$;

revoke all on function public.subsidize_construction_project (uuid, uuid)
from
  public;

grant
execute on function public.subsidize_construction_project (uuid, uuid) to authenticated;
