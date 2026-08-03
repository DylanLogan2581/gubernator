-- pgTAP tests for the 'education' effects_json entry validation on
-- building_blueprint_tiers (#1170).
-- education_config_json and its object-type CHECK are gone; education is
-- now a tagged entry inside the generic effects_json array, validated by
-- public.is_valid_tier_effects_array via the
-- building_blueprint_tiers_validate_json BEFORE trigger
-- (public.validate_building_tier_json), which raises errcode P0001 on any
-- shape/referential violation.
-- Run with: npx supabase test db
begin;

select
  plan (7);

-- ---------------------------------------------------------------------------
-- Fixtures
--   bec1xxxx = worlds            bec2xxxx = education_levels
--   bec3xxxx = job_definitions   bec4xxxx = building_blueprints
-- ---------------------------------------------------------------------------
insert into
  public.worlds (id, name, status)
values
  (
    'bec10000-0000-0000-0000-000000000001',
    'BTEC World',
    'active'
  );

insert into
  public.education_levels (id, world_id, name, rank)
values
  (
    'bec20000-0000-0000-0000-000000000001',
    'bec10000-0000-0000-0000-000000000001',
    'Basic',
    1
  ),
  (
    'bec20000-0000-0000-0000-000000000002',
    'bec10000-0000-0000-0000-000000000001',
    'Advanced',
    2
  );

insert into
  public.job_definitions (
    id,
    world_id,
    name,
    slug,
    job_type,
    base_capacity,
    is_trashed
  )
values
  (
    'bec30000-0000-0000-0000-000000000001',
    'bec10000-0000-0000-0000-000000000001',
    'BTEC Teacher',
    'btc-teacher',
    'teacher',
    5,
    false
  ),
  (
    'bec30000-0000-0000-0000-000000000002',
    'bec10000-0000-0000-0000-000000000001',
    'BTEC Farmer',
    'btc-farmer',
    'standard',
    5,
    false
  );

insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'bec40000-0000-0000-0000-000000000001',
    'bec10000-0000-0000-0000-000000000001',
    'Schoolhouse',
    'btc-schoolhouse'
  );

-- ===========================================================================
-- effects_json 'education' entry — shape and referential validation
-- ===========================================================================
select
  lives_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, effects_json)
    values ('bec40000-0000-0000-0000-000000000001', 1, '[]'::jsonb)
    $test$,
    'empty effects_json is accepted (not a school)'
  );

select
  lives_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, effects_json)
    values (
      'bec40000-0000-0000-0000-000000000001', 2,
      jsonb_build_array(
        jsonb_build_object(
          'type', 'education',
          'teacher_job_id', 'bec30000-0000-0000-0000-000000000001',
          'teacher_capacity', 2,
          'students_per_teacher', 5,
          'levels', jsonb_build_array(
            jsonb_build_object(
              'from_level_id', null,
              'to_level_id', 'bec20000-0000-0000-0000-000000000001',
              'turns', 4
            ),
            jsonb_build_object(
              'from_level_id', 'bec20000-0000-0000-0000-000000000001',
              'to_level_id', 'bec20000-0000-0000-0000-000000000002',
              'turns', 4
            )
          )
        )
      )
    )
    $test$,
    'a valid education entry with a null -> Basic -> Advanced level chain is accepted'
  );

select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, effects_json)
    values (
      'bec40000-0000-0000-0000-000000000001', 3,
      jsonb_build_array(
        jsonb_build_object(
          'type', 'education',
          'teacher_capacity', 2,
          'students_per_teacher', 5,
          'levels', jsonb_build_array(
            jsonb_build_object(
              'from_level_id', null,
              'to_level_id', 'bec20000-0000-0000-0000-000000000001',
              'turns', 4
            )
          )
        )
      )
    )
    $test$,
    'P0001',
    null,
    'an education entry missing teacher_job_id is rejected'
  );

select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, effects_json)
    values (
      'bec40000-0000-0000-0000-000000000001', 4,
      jsonb_build_array(
        jsonb_build_object(
          'type', 'education',
          'teacher_job_id', 'bec30000-0000-0000-0000-000000000001',
          'teacher_capacity', 2,
          'students_per_teacher', 5,
          'levels', '[]'::jsonb
        )
      )
    )
    $test$,
    'P0001',
    null,
    'an education entry with an empty levels array is rejected'
  );

select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, effects_json)
    values (
      'bec40000-0000-0000-0000-000000000001', 5,
      jsonb_build_array(
        jsonb_build_object(
          'type', 'education',
          'teacher_job_id', 'bec30000-0000-0000-0000-000000000002',
          'teacher_capacity', 2,
          'students_per_teacher', 5,
          'levels', jsonb_build_array(
            jsonb_build_object(
              'from_level_id', null,
              'to_level_id', 'bec20000-0000-0000-0000-000000000001',
              'turns', 4
            )
          )
        )
      )
    )
    $test$,
    'P0001',
    null,
    'a teacher_job_id pointing at a non-teacher job is rejected'
  );

select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, effects_json)
    values (
      'bec40000-0000-0000-0000-000000000001', 6,
      jsonb_build_array(
        jsonb_build_object(
          'type', 'education',
          'teacher_job_id', 'bec30000-0000-0000-0000-000000000001',
          'teacher_capacity', 2,
          'students_per_teacher', 5,
          'levels', jsonb_build_array(
            jsonb_build_object(
              'from_level_id', null,
              'to_level_id', 'bec20000-0000-0000-0000-000000000001',
              'turns', 4
            ),
            jsonb_build_object(
              'from_level_id', null,
              'to_level_id', 'bec20000-0000-0000-0000-000000000002',
              'turns', 4
            )
          )
        )
      )
    )
    $test$,
    'P0001',
    null,
    'a duplicate from_level_id within levels is rejected'
  );

select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, effects_json)
    values (
      'bec40000-0000-0000-0000-000000000001', 7,
      jsonb_build_array(
        jsonb_build_object(
          'type', 'education',
          'teacher_job_id', 'bec30000-0000-0000-0000-000000000001',
          'teacher_capacity', 2,
          'students_per_teacher', 5,
          'levels', jsonb_build_array(
            jsonb_build_object(
              'from_level_id', null,
              'to_level_id', 'bec20000-0000-0000-0000-000000000001',
              'turns', 4
            )
          )
        ),
        jsonb_build_object(
          'type', 'education',
          'teacher_job_id', 'bec30000-0000-0000-0000-000000000001',
          'teacher_capacity', 1,
          'students_per_teacher', 5,
          'levels', jsonb_build_array(
            jsonb_build_object(
              'from_level_id', 'bec20000-0000-0000-0000-000000000001',
              'to_level_id', 'bec20000-0000-0000-0000-000000000002',
              'turns', 4
            )
          )
        )
      )
    )
    $test$,
    'P0001',
    null,
    'more than one education entry in the same effects_json array is rejected'
  );

select
  *
from
  finish ();

rollback;
