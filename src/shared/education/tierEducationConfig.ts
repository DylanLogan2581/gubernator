// Typed shape and parser for building_blueprint_tiers.education_config_json
// (#1101). Null on the row means the tier is not a school.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

export type TierEducationConfig = {
  readonly studentCapacity: number;
  readonly studentsPerTeacher: number;
  readonly teacherJobId: string;
  readonly teachesUpToLevelId: string;
  readonly turnsPerLevel: number;
};

export function parseTierEducationConfig(
  payload: unknown,
): TierEducationConfig | null {
  if (payload === null || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.teaches_up_to_level_id !== "string") return null;
  if (typeof p.student_capacity !== "number") return null;
  if (typeof p.turns_per_level !== "number") return null;
  if (typeof p.teacher_job_id !== "string") return null;
  if (typeof p.students_per_teacher !== "number") return null;
  return {
    studentCapacity: p.student_capacity,
    studentsPerTeacher: p.students_per_teacher,
    teacherJobId: p.teacher_job_id,
    teachesUpToLevelId: p.teaches_up_to_level_id,
    turnsPerLevel: p.turns_per_level,
  };
}
