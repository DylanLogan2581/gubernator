-- Final tidy-up at turn 32 for the Bovold Seed World. Re-staff every settlement
-- (all assignment types, food/water scaled to each settlement's building
-- capacity), restock herds, restore readiness, set trade status, reactivate
-- buildings and top up survival stockpiles. History tables are untouched.
-- Everything resolves by name/slug (no hardcoded UUIDs); the builder generates
-- deterministic real UUIDs. Player characters, office-holders and soldiers are
-- kept out of the labour pool.
do $$
declare
  v_world uuid;
  v_field uuid; v_water uuid; v_grain uuid; v_brewer uuid; v_weaver uuid; v_teacher uuid;
  r record; v_ids uuid[]; v_n int; v_idx int; j int; k int; v_pop int;
  v_gran int; v_cist int; v_field_cap int; v_water_cap int;
  v_jobs uuid[]; v_cnts int[]; dep record; pop record; v_cid uuid; v_has_school boolean;
begin
  select id into v_world from public.worlds where name = 'Bovold Seed World';
  select id into v_field   from public.job_definitions where world_id = v_world and slug = 'field-hand';
  select id into v_water   from public.job_definitions where world_id = v_world and slug = 'water-bearer';
  select id into v_grain   from public.job_definitions where world_id = v_world and slug = 'grain-farmer';
  select id into v_brewer  from public.job_definitions where world_id = v_world and slug = 'brewer';
  select id into v_weaver  from public.job_definitions where world_id = v_world and slug = 'cloth-weaver';
  select id into v_teacher from public.job_definitions where world_id = v_world and slug = 'teacher';

  -- Fresh staffing: wipe all assignments (soldiers are tracked in unit_soldiers,
  -- not citizen_assignments, so they stay out of the pool automatically).
  delete from public.citizen_assignments a using public.citizens c
    where a.citizen_id = c.id and c.world_id = v_world;

  -- Restock managed populations to healthy, sustainable, staffable levels.
  update public.managed_population_instances mpi
  set status = 'active',
      current_count = greatest(mpi.current_count, 55),
      configured_cull_quantity = least(mpi.configured_cull_quantity, 4)
  from public.settlements s
  join public.nations n on n.id = s.nation_id
  where mpi.settlement_id = s.id and n.world_id = v_world;

  -- Reactivate every trade route the 32-turn run paused, so the neutral trade
  -- hub is visibly trading at the snapshot (and the trade_route assignment type
  -- gets staffed below). Approvals are backfilled to the Lord-Mayor.
  update public.trade_routes tr
  set status = 'active',
      origin_approval_status = 'approved',
      destination_approval_status = 'approved',
      origin_approved_by_citizen_id = coalesce(tr.origin_approved_by_citizen_id,
        (select id from public.citizens where world_id = v_world and given_name = 'Bertram' and surname = 'Underhill' limit 1)),
      destination_approved_by_citizen_id = coalesce(tr.destination_approved_by_citizen_id,
        (select id from public.citizens where world_id = v_world and given_name = 'Bertram' and surname = 'Underhill' limit 1))
  from public.settlements s
  join public.nations n on n.id = s.nation_id
  where tr.origin_settlement_id = s.id and n.world_id = v_world;

  -- Trade-route workers first (guarantees the trade_route assignment type
  -- survives before the main staffing loop consumes the adult pool).
  for r in
    select tr.id rid, tr.origin_settlement_id osid, tr.destination_settlement_id dsid
    from public.trade_routes tr
    join public.settlements s on s.id = tr.origin_settlement_id
    join public.nations n on n.id = s.nation_id
    where n.world_id = v_world and tr.status = 'active'
  loop
    select id into v_cid from public.citizens
      where settlement_id = r.osid and citizen_type = 'npc' and status = 'alive'
        and born_on_turn_number <= -16 and id not in (select citizen_id from public.citizen_assignments)
        and id not in (select citizen_id from public.unit_soldiers)
      order by born_on_turn_number, id limit 1;
    if v_cid is not null then
      insert into public.citizen_assignments (citizen_id, assignment_type, trade_route_id, trade_route_end, assigned_on_turn_number)
      values (v_cid, 'trade_route', r.rid, 'origin', 32);
    end if;
    select id into v_cid from public.citizens
      where settlement_id = r.dsid and citizen_type = 'npc' and status = 'alive'
        and born_on_turn_number <= -16 and id not in (select citizen_id from public.citizen_assignments)
        and id not in (select citizen_id from public.unit_soldiers)
      order by born_on_turn_number, id limit 1;
    if v_cid is not null then
      insert into public.citizen_assignments (citizen_id, assignment_type, trade_route_id, trade_route_end, assigned_on_turn_number)
      values (v_cid, 'trade_route', r.rid, 'destination', 32);
    end if;
  end loop;

  -- Main staffing per settlement: food/water sized to the settlement's active
  -- granary/cistern capacity, then production / extraction / husbandry / culling
  -- / construction / teaching / craft chains.
  for r in
    select s.id sid from public.settlements s
    join public.nations n on n.id = s.nation_id
    where n.world_id = v_world
  loop
    select
      count(*) filter (where bp.slug = 'granary'),
      count(*) filter (where bp.slug = 'cistern'),
      bool_or(bp.slug = 'school')
    into v_gran, v_cist, v_has_school
    from public.settlement_buildings sb
    join public.building_blueprints bp on bp.id = sb.building_blueprint_id
    where sb.settlement_id = r.sid and sb.state = 'active';
    v_gran := greatest(coalesce(v_gran, 0), 1);
    v_cist := greatest(coalesce(v_cist, 0), 1);
    v_field_cap := 30 + 6 * v_gran;
    v_water_cap := 24 + 6 * v_cist;
    select count(*) into v_pop from public.citizens where settlement_id = r.sid and status = 'alive';

    v_ids := array(select id from public.citizens
                   where settlement_id = r.sid and citizen_type = 'npc' and status = 'alive'
                     and born_on_turn_number <= -16
                     and id not in (select citizen_id from public.citizen_assignments)
                     and id not in (select citizen_id from public.unit_soldiers)
                     and id not in (select citizen_id from public.nation_offices)
                   order by born_on_turn_number, id);
    v_n := coalesce(array_length(v_ids, 1), 0); v_idx := 1;

    v_jobs := array[v_field, v_water, v_grain];
    v_cnts := array[
      least(v_field_cap, greatest(8, ceil(v_pop / 4.0)::int)),
      least(v_water_cap, greatest(8, ceil(v_pop / 4.0)::int)),
      3];
    for j in 1..3 loop
      for k in 1..v_cnts[j] loop exit when v_idx > v_n;
        insert into public.citizen_assignments (citizen_id, assignment_type, job_id, assigned_on_turn_number)
          values (v_ids[v_idx], 'standard_job', v_jobs[j], 32); v_idx := v_idx + 1; end loop;
    end loop;
    for dep in select di.id did from public.deposit_instances di where di.settlement_id = r.sid and di.status = 'active' loop
      for k in 1..2 loop exit when v_idx > v_n;
        insert into public.citizen_assignments (citizen_id, assignment_type, deposit_instance_id, assigned_on_turn_number)
          values (v_ids[v_idx], 'deposit', dep.did, 32); v_idx := v_idx + 1; end loop;
    end loop;
    for pop in select mpi.id mid, mpi.configured_cull_quantity cq from public.managed_population_instances mpi where mpi.settlement_id = r.sid and mpi.status = 'active' loop
      for k in 1..2 loop exit when v_idx > v_n;
        insert into public.citizen_assignments (citizen_id, assignment_type, managed_population_instance_id, assigned_on_turn_number)
          values (v_ids[v_idx], 'husbandry', pop.mid, 32); v_idx := v_idx + 1; end loop;
      if pop.cq > 0 and v_idx <= v_n then
        insert into public.citizen_assignments (citizen_id, assignment_type, managed_population_instance_id, assigned_on_turn_number)
          values (v_ids[v_idx], 'culling', pop.mid, 32); v_idx := v_idx + 1; end if;
    end loop;
    for k in 1..3 loop exit when v_idx > v_n;
      insert into public.citizen_assignments (citizen_id, assignment_type, construction_project_id, assigned_on_turn_number)
        values (v_ids[v_idx], 'construction_project', null, 32); v_idx := v_idx + 1; end loop;
    if v_has_school and v_idx <= v_n then
      insert into public.citizen_assignments (citizen_id, assignment_type, job_id, assigned_on_turn_number)
        values (v_ids[v_idx], 'standard_job', v_teacher, 32); v_idx := v_idx + 1; end if;
    v_jobs := array[v_brewer, v_weaver]; v_cnts := array[2, 2];
    for j in 1..2 loop
      for k in 1..v_cnts[j] loop exit when v_idx > v_n;
        insert into public.citizen_assignments (citizen_id, assignment_type, job_id, assigned_on_turn_number)
          values (v_ids[v_idx], 'standard_job', v_jobs[j], 32); v_idx := v_idx + 1; end loop;
    end loop;
  end loop;

  -- Readiness: City of Bovold manual-ready; Highcanopy auto-ready; rest not.
  update public.settlements set auto_ready_enabled = false, is_ready_current_turn = true,
    last_ready_at = '2026-06-19 12:00:00+00', ready_set_at = '2026-06-19 12:00:00+00'
    where id = (select id from public.settlements where name = 'City of Bovold');
  update public.settlements set auto_ready_enabled = true, is_ready_current_turn = true
    where id = (select id from public.settlements where name = 'Highcanopy');
  update public.settlements s set is_ready_current_turn = false, ready_set_at = null
    from public.nations n
    where s.nation_id = n.id and n.world_id = v_world
      and s.name not in ('City of Bovold', 'Highcanopy');

  -- Reactivate any building the run suspended.
  update public.settlement_buildings sb set state = 'active'
  from public.settlements s
  join public.nations n on n.id = s.nation_id
  where sb.settlement_id = s.id and n.world_id = v_world and sb.state <> 'active';

  -- Top up survival stockpiles so every settlement shows a healthy reserve.
  update public.settlement_resource_stockpiles sp set quantity = greatest(sp.quantity, 250)
  from public.resources rr, public.settlements s
  join public.nations n on n.id = s.nation_id
  where rr.id = sp.resource_id and rr.slug in ('food', 'fresh-water')
    and sp.settlement_id = s.id and n.world_id = v_world;
end$$;
