// Typed shape and parser for the "education" building_blueprint_tiers
// effects_json entry (#1170). Education is one tagged entry among the tier's
// generic effects array; a tier with no "education"-typed entry is not a
// school.
//
// levels[] is an explicit list of transitions: fromLevelId null means
// "starting from no education". "Teaches up to X" is expressed as the full
// chain of consecutive transitions from null through X; "only teaches
// X -> Y" is a single entry, which lets a tier exclude uneducated citizens
// by omitting the null -> first-level transition.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

export type TierEducationLevelTransition = {
  readonly fromLevelId: string | null;
  readonly toLevelId: string;
  readonly turns: number;
};

export type TierEducationConfig = {
  readonly levels: readonly TierEducationLevelTransition[];
  readonly studentsPerTeacher: number;
  readonly teacherCapacity: number;
  readonly teacherJobId: string;
};

function parseLevelTransition(
  payload: unknown,
): TierEducationLevelTransition | null {
  if (payload === null || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.from_level_id !== "string" && p.from_level_id !== null) {
    return null;
  }
  if (typeof p.to_level_id !== "string") return null;
  if (typeof p.turns !== "number") return null;
  return {
    fromLevelId: p.from_level_id,
    toLevelId: p.to_level_id,
    turns: p.turns,
  };
}

export function parseTierEducationConfig(
  payload: unknown,
): TierEducationConfig | null {
  if (payload === null || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (p.type !== "education") return null;
  if (typeof p.teacher_job_id !== "string") return null;
  if (typeof p.teacher_capacity !== "number") return null;
  if (typeof p.students_per_teacher !== "number") return null;
  if (!Array.isArray(p.levels) || p.levels.length === 0) return null;

  const levels: TierEducationLevelTransition[] = [];
  for (const rawLevel of p.levels) {
    const level = parseLevelTransition(rawLevel);
    if (level === null) return null;
    levels.push(level);
  }

  return {
    levels,
    studentsPerTeacher: p.students_per_teacher,
    teacherCapacity: p.teacher_capacity,
    teacherJobId: p.teacher_job_id,
  };
}
