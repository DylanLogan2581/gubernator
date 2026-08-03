-- Migration: fix_enroll_citizen_capacity_and_soldier_guard
-- #1139: enroll_citizen had three defects, redefined in full from its only
-- prior definition (20260925000000_add_education_enrollments.sql):
--   1. v_student_capacity was never null-checked -- a school tier whose
--      education_config_json omits student_capacity made the capacity
--      comparison evaluate NULL (bypassing the guard entirely, allowing
--      unlimited enrollment). Now null capacity is rejected explicitly.
--   2. No lock on the settlement_buildings row before counting current
--      enrollments -- concurrent enrolls could race past capacity. Now the
--      row is locked (for update) before the count is taken.
--   3. recruit_soldiers (20260930000000) rejects already-enrolled citizens,
--      but enroll_citizen never gained the mirrored guard -- an enlisted
--      soldier could still enroll in school. Added.
-- ---------------------------------------------------------------------------
create or replace function public.enroll_citizen (p_settlement_building_id uuid, p_citizen_id uuid) returns setof public.education_enrollments language plpgsql security definer
set
  search_path = '' as $$
declare
  v_world_id           uuid;
  v_settlement_id      uuid;
  v_building_state     text;
  v_education_config   jsonb;
  v_turn_number        integer;
  v_citizen_settlement uuid;
  v_citizen_status     text;
  v_citizen_rank       integer;
  v_teaches_up_to_id   uuid;
  v_teaches_up_to_rank integer;
  v_student_capacity   integer;
  v_current_enrolled   integer;
  v_target_level_id    uuid;
  v_result             public.education_enrollments;
begin
  if p_settlement_building_id is null or p_citizen_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  select s.id, n.world_id, sb.state, bbt.education_config_json
    into v_settlement_id, v_world_id, v_building_state, v_education_config
    from public.settlement_buildings sb
    join public.settlements s on s.id = sb.settlement_id
    join public.nations n on n.id = s.nation_id
    join public.building_blueprint_tiers bbt on bbt.id = sb.current_tier_id
   where sb.id = p_settlement_building_id;

  if v_settlement_id is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if not (
    public.is_super_admin ()
    or public.is_world_admin (v_world_id)
    or public.current_user_manages_settlement (v_settlement_id)
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  if public.world_is_archived (v_world_id) then
    raise exception 'Archived worlds are read-only.' using errcode = '22023';
  end if;

  if v_building_state <> 'active' then
    raise exception 'settlement building is not active' using errcode = 'P0001';
  end if;

  if v_education_config is null then
    raise exception 'settlement building is not configured as a school' using errcode = 'P0001';
  end if;

  select c.settlement_id, c.status, el.rank
    into v_citizen_settlement, v_citizen_status, v_citizen_rank
    from public.citizens c
    left join public.education_levels el on el.id = c.education_level_id
   where c.id = p_citizen_id;

  if v_citizen_status is null then
    raise exception 'not found' using errcode = 'P0002';
  end if;

  if v_citizen_status <> 'alive' then
    raise exception 'citizen is not alive' using errcode = 'P0001';
  end if;

  if v_citizen_settlement is null or v_citizen_settlement <> v_settlement_id then
    raise exception 'citizen does not belong to this settlement' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.education_enrollments where citizen_id = p_citizen_id) then
    raise exception 'citizen is already enrolled in a school' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.unit_soldiers where citizen_id = p_citizen_id) then
    raise exception 'citizen is enlisted as a soldier' using errcode = 'P0001';
  end if;

  v_student_capacity := (v_education_config ->> 'student_capacity')::integer;

  perform 1
    from public.settlement_buildings
   where id = p_settlement_building_id
   for update;

  select count(*)::integer
    into v_current_enrolled
    from public.education_enrollments
   where settlement_building_id = p_settlement_building_id;

  if v_student_capacity is null or v_current_enrolled >= v_student_capacity then
    raise exception 'settlement building is at student capacity' using errcode = 'P0001';
  end if;

  v_teaches_up_to_id := (v_education_config ->> 'teaches_up_to_level_id')::uuid;

  select rank
    into v_teaches_up_to_rank
    from public.education_levels
   where id = v_teaches_up_to_id;

  if v_teaches_up_to_rank is null or coalesce(v_citizen_rank, 0) >= v_teaches_up_to_rank then
    raise exception 'Nothing left to learn here' using errcode = 'P0001';
  end if;

  select id
    into v_target_level_id
    from public.education_levels
   where world_id = v_world_id
     and rank > coalesce(v_citizen_rank, 0)
   order by rank asc
   limit 1;

  select w.current_turn_number
    into v_turn_number
    from public.worlds w
   where w.id = v_world_id;

  insert into public.education_enrollments (
    world_id, settlement_building_id, citizen_id, target_level_id, enrolled_turn_number
  ) values (
    v_world_id, p_settlement_building_id, p_citizen_id, v_target_level_id, v_turn_number
  )
  returning * into v_result;

  return next v_result;
end;
$$;
