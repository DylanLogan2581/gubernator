-- Migration: fix_subsidize_construction_project_status
-- #1144: subsidize_construction_project never checked project status, so
-- completed/cancelled projects could still be "subsidized" — moving nation
-- stock into the settlement with a misleading notification. Now rejects any
-- project not in a non-terminal status, matching the terminal-status check
-- already used by set_bulk_construction_assignment.
--
-- Secondary: nation stockpile row locks are now taken in resource_id order
-- (instead of construction_costs_json order) to remove a theoretical
-- deadlock between two concurrent subsidize_construction_project calls whose
-- tiers list the same resources in different orders.
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
  v_project_status text;
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

  select cp.settlement_id, cp.target_tier_id, cp.status, s.nation_id
  into v_settlement_id, v_target_tier_id, v_project_status, v_settlement_nation_id
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

  if v_project_status in ('complete', 'cancelled') then
    raise exception 'construction project is in a terminal status (%)', v_project_status
      using errcode = '22023';
  end if;

  for v_cost in
    select value
    from public.building_blueprint_tiers t
    cross join lateral jsonb_array_elements(t.construction_costs_json) as value
    where t.id = v_target_tier_id
    order by (value ->> 'resource_id')::uuid
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
