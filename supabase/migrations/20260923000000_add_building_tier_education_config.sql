-- Migration: add_building_tier_education_config
-- #1101: building_blueprint_tiers gain an optional education_config_json
-- column so a tier can declare itself a school. Null means "not a school".
--
-- Shape: { teaches_up_to_level_id: uuid, student_capacity: int > 0,
--          turns_per_level: int > 0, teacher_job_id: uuid,
--          students_per_teacher: int > 0 }
--
-- Full shape/referential validation (all five fields required together,
-- positive integers, uuid references) happens in app code. The DB only
-- enforces that a non-null value is a JSON object -- higher tiers may teach
-- higher levels / larger capacity and there is no cross-tier validation
-- in v1.
-- ---------------------------------------------------------------------------
alter table public.building_blueprint_tiers
add column education_config_json jsonb null;

alter table public.building_blueprint_tiers
add constraint building_blueprint_tiers_education_config_object_check check (
  education_config_json is null
  or jsonb_typeof(education_config_json) = 'object'
);
