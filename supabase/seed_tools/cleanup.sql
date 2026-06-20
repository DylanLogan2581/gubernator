-- Final tidy-up at turn 32: re-staff every settlement (all assignment types,
-- food/water scaled to the grown population), restore readiness, set trade
-- status, ensure buildings active. History tables are untouched.
delete from public.citizen_assignments a using public.citizens c
  where a.citizen_id = c.id and c.world_id = '00000000-0000-0000-0000-000000000101';

-- Restock managed populations the 32-turn run drove to extinction, at
-- sustainable levels (cull rate <= natural growth) so the husbandry/herding
-- layer is healthy and staffable.
update public.managed_population_instances mpi
set status='active',
    current_count = greatest(mpi.current_count, 55),
    configured_cull_quantity = least(mpi.configured_cull_quantity, 4)
from public.settlements s, public.nations n
where mpi.settlement_id = s.id and s.nation_id = n.id
  and n.world_id = '00000000-0000-0000-0000-000000000101';

-- Trade-route workers first (guarantees the trade_route assignment type).
do $$
declare r record; v_cid uuid;
begin
  for r in select * from (values
    ('00000000-0000-0000-000e-000000000101'::uuid,'origin',     '00000000-0000-0000-0000-000000000301'::uuid),
    ('00000000-0000-0000-000e-000000000101'::uuid,'destination','00000000-0000-0000-0000-000000000304'::uuid),
    ('00000000-0000-0000-000e-000000000103'::uuid,'origin',     '00000000-0000-0000-0000-000000000304'::uuid),
    ('00000000-0000-0000-000e-000000000103'::uuid,'destination','00000000-0000-0000-0000-000000000301'::uuid),
    ('00000000-0000-0000-000e-000000000102'::uuid,'origin',     '00000000-0000-0000-0000-000000000303'::uuid),
    ('00000000-0000-0000-000e-000000000102'::uuid,'destination','00000000-0000-0000-0000-000000000306'::uuid)
  ) as t(route, e, sid) loop
    select id into v_cid from public.citizens where settlement_id=r.sid and citizen_type='npc' and status='alive'
      and born_on_turn_number <= -16 and id not in (select citizen_id from public.citizen_assignments)
      order by born_on_turn_number, id limit 1;
    if v_cid is not null then
      insert into public.citizen_assignments(citizen_id,assignment_type,trade_route_id,trade_route_end,assigned_on_turn_number)
        values (v_cid,'trade_route',r.route,r.e,32);
    end if;
  end loop;
end$$;

-- Main staffing: food/water sized to keep each settlement sustainable, then the
-- production / extraction / husbandry / culling / construction / craft chains.
do $$
declare
  v_cfg record; v_ids uuid[]; v_n int; v_idx int; j int; k int;
  v_jobs1 uuid[]; v_cnts1 int[]; v_jobs2 uuid[]; dep record; pop record;
  v_field uuid := '00000000-0000-0000-0005-000000000101';
  v_water uuid := '00000000-0000-0000-0005-000000000102';
  v_grain uuid := '00000000-0000-0000-0005-000000000103';
  v_brewer uuid := '00000000-0000-0000-0005-000000000104';
  v_weaver uuid := '00000000-0000-0000-0005-000000000105';
begin
  for v_cfg in select * from (values
    ('00000000-0000-0000-0000-000000000301'::uuid, 15, 12),
    ('00000000-0000-0000-0000-000000000302'::uuid,  7,  5),
    ('00000000-0000-0000-0000-000000000303'::uuid,  7,  5),
    ('00000000-0000-0000-0000-000000000304'::uuid,  7,  5),
    ('00000000-0000-0000-0000-000000000305'::uuid,  7,  5),
    ('00000000-0000-0000-0000-000000000306'::uuid,  7,  6)
  ) as t(sid, fld, wtr) loop
    v_ids := array(select id from public.citizens
                   where settlement_id = v_cfg.sid and citizen_type='npc' and status='alive'
                     and born_on_turn_number <= -16
                     and id not in (select citizen_id from public.citizen_assignments)
                   order by born_on_turn_number, id);
    v_n := coalesce(array_length(v_ids,1),0); v_idx := 1;
    v_jobs1 := array[v_field, v_water, v_grain]; v_cnts1 := array[v_cfg.fld, v_cfg.wtr, 2];
    for j in 1..3 loop
      for k in 1..v_cnts1[j] loop exit when v_idx > v_n;
        insert into public.citizen_assignments(citizen_id,assignment_type,job_id,assigned_on_turn_number)
          values (v_ids[v_idx],'standard_job',v_jobs1[j],32); v_idx := v_idx+1; end loop;
    end loop;
    for dep in select di.id did from public.deposit_instances di where di.settlement_id=v_cfg.sid and di.status='active' loop
      for k in 1..3 loop exit when v_idx > v_n;
        insert into public.citizen_assignments(citizen_id,assignment_type,deposit_instance_id,assigned_on_turn_number)
          values (v_ids[v_idx],'deposit',dep.did,32); v_idx := v_idx+1; end loop;
    end loop;
    for pop in select mpi.id mid, mpi.configured_cull_quantity cq from public.managed_population_instances mpi where mpi.settlement_id=v_cfg.sid and mpi.status='active' loop
      for k in 1..2 loop exit when v_idx > v_n;
        insert into public.citizen_assignments(citizen_id,assignment_type,managed_population_instance_id,assigned_on_turn_number)
          values (v_ids[v_idx],'husbandry',pop.mid,32); v_idx := v_idx+1; end loop;
      if pop.cq > 0 and v_idx <= v_n then
        insert into public.citizen_assignments(citizen_id,assignment_type,managed_population_instance_id,assigned_on_turn_number)
          values (v_ids[v_idx],'culling',pop.mid,32); v_idx := v_idx+1; end if;
    end loop;
    for k in 1..2 loop exit when v_idx > v_n;
      insert into public.citizen_assignments(citizen_id,assignment_type,construction_project_id,assigned_on_turn_number)
        values (v_ids[v_idx],'construction_project',null,32); v_idx := v_idx+1; end loop;
    v_jobs2 := array[v_brewer, v_weaver];
    for j in 1..2 loop
      for k in 1..2 loop exit when v_idx > v_n;
        insert into public.citizen_assignments(citizen_id,assignment_type,job_id,assigned_on_turn_number)
          values (v_ids[v_idx],'standard_job',v_jobs2[j],32); v_idx := v_idx+1; end loop;
    end loop;
  end loop;
end$$;

update public.settlements set auto_ready_enabled=false, is_ready_current_turn=true,  last_ready_at='2026-06-19 12:00:00+00', ready_set_at='2026-06-19 12:00:00+00' where id='00000000-0000-0000-0000-000000000301';
update public.settlements set auto_ready_enabled=true,  is_ready_current_turn=true where id='00000000-0000-0000-0000-000000000303';
update public.settlements set auto_ready_enabled=false, is_ready_current_turn=false, ready_set_at=null where id in ('00000000-0000-0000-0000-000000000302','00000000-0000-0000-0000-000000000304','00000000-0000-0000-0000-000000000305','00000000-0000-0000-0000-000000000306');
update public.trade_routes set status='active' where id in ('00000000-0000-0000-000e-000000000101','00000000-0000-0000-000e-000000000103');
update public.trade_routes set status='proposed', origin_approval_status='pending', destination_approval_status='pending', origin_approved_by_citizen_id=null, destination_approved_by_citizen_id=null where id='00000000-0000-0000-000e-000000000102';
update public.settlement_buildings set state='active' where state <> 'active';

-- Top up survival stockpiles so every settlement shows a healthy Food / Fresh
-- Water reserve at the snapshot (production already covers consumption).
update public.settlement_resource_stockpiles sp
set quantity = greatest(sp.quantity, 250)
from public.resources r, public.settlements s, public.nations n
where r.id = sp.resource_id and r.slug in ('food','fresh-water')
  and sp.settlement_id = s.id and s.nation_id = n.id
  and n.world_id = '00000000-0000-0000-0000-000000000101';
