import { describe, expect, it } from "vitest";

import { parseTierEducationConfig } from "./tierEducationConfig.ts";

const VALID: Record<string, unknown> = {
  student_capacity: 20,
  students_per_teacher: 5,
  teacher_job_id: "job-1",
  teaches_up_to_level_id: "level-1",
  turns_per_level: 4,
};

function expectNullForCommonMalformed(
  parse: (input: unknown) => unknown,
): void {
  expect(parse(null)).toBeNull();
  expect(parse(undefined)).toBeNull();
  expect(parse("string")).toBeNull();
  expect(parse(42)).toBeNull();
  expect(parse([])).toBeNull();
}

describe("parseTierEducationConfig", () => {
  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseTierEducationConfig);
  });

  it("returns null when any field is missing or the wrong type", () => {
    for (const key of Object.keys(VALID)) {
      const { [key]: _omitted, ...missing } = VALID;
      expect(parseTierEducationConfig(missing)).toBeNull();
      expect(parseTierEducationConfig({ ...VALID, [key]: true })).toBeNull();
    }
  });

  it("returns typed config for valid input", () => {
    expect(parseTierEducationConfig(VALID)).toEqual({
      studentCapacity: 20,
      studentsPerTeacher: 5,
      teacherJobId: "job-1",
      teachesUpToLevelId: "level-1",
      turnsPerLevel: 4,
    });
  });
});
