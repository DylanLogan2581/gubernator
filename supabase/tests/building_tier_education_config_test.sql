-- pgTAP tests for education_config_json object-type CHECK on
-- building_blueprint_tiers (#1101).
-- Full shape/referential validation lives in app code; the DB only rejects
-- non-object values here.
-- Run with: npx supabase test db
begin;

select
  plan (3);

-- ---------------------------------------------------------------------------
-- Fixtures
-- ---------------------------------------------------------------------------
insert into
  public.worlds (id, name, visibility, status)
values
  (
    'd2000000-0000-0000-0000-000000000001',
    'BTEC World',
    'private',
    'active'
  );

insert into
  public.building_blueprints (id, world_id, name, slug)
values
  (
    'd5000000-0000-0000-0000-000000000001',
    'd2000000-0000-0000-0000-000000000001',
    'Schoolhouse',
    'schoolhouse'
  );

-- ===========================================================================
-- EDUCATION_CONFIG_JSON — object-type validation
-- ===========================================================================
select
  lives_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, education_config_json)
    values ('d5000000-0000-0000-0000-000000000001', 1, null)
    $test$,
    'education_config_json null is accepted (not a school)'
  );

select
  lives_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, education_config_json)
    values (
      'd5000000-0000-0000-0000-000000000001', 2,
      '{"teaches_up_to_level_id": "00000000-0000-0000-0000-000000000000", "student_capacity": 10, "turns_per_level": 4, "teacher_job_id": "00000000-0000-0000-0000-000000000000", "students_per_teacher": 5}'
    )
    $test$,
    'education_config_json object is accepted'
  );

select
  throws_ok (
    $test$
    insert into public.building_blueprint_tiers (building_blueprint_id, tier_number, education_config_json)
    values (
      'd5000000-0000-0000-0000-000000000001', 3,
      '[1, 2, 3]'
    )
    $test$,
    '23514',
    null,
    'education_config_json that is not an object is rejected'
  );

select
  *
from
  finish ();

rollback;
