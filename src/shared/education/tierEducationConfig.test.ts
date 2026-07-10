import { describe, expect, it } from "vitest";

import { parseTierEducationConfig } from "./tierEducationConfig.ts";

const VALID: Record<string, unknown> = {
  levels: [
    { from_level_id: null, to_level_id: "level-1", turns: 4 },
    { from_level_id: "level-1", to_level_id: "level-2", turns: 6 },
  ],
  students_per_teacher: 5,
  teacher_capacity: 3,
  teacher_job_id: "job-1",
  type: "education",
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

  it("returns null when the type tag is not education", () => {
    expect(parseTierEducationConfig({ ...VALID, type: "other" })).toBeNull();
  });

  it("returns null when a top-level field is missing or the wrong type", () => {
    for (const key of [
      "teacher_job_id",
      "teacher_capacity",
      "students_per_teacher",
    ]) {
      const { [key]: _omitted, ...missing } = VALID;
      expect(parseTierEducationConfig(missing)).toBeNull();
      expect(parseTierEducationConfig({ ...VALID, [key]: true })).toBeNull();
    }
  });

  it("returns null when levels is missing, empty, or malformed", () => {
    expect(
      parseTierEducationConfig({ ...VALID, levels: undefined }),
    ).toBeNull();
    expect(parseTierEducationConfig({ ...VALID, levels: [] })).toBeNull();
    expect(
      parseTierEducationConfig({
        ...VALID,
        levels: [{ from_level_id: null, to_level_id: "level-1" }],
      }),
    ).toBeNull();
  });

  it("accepts a null fromLevelId (starting from no education)", () => {
    expect(
      parseTierEducationConfig({
        ...VALID,
        levels: [{ from_level_id: null, to_level_id: "level-1", turns: 4 }],
      }),
    ).toEqual({
      levels: [{ fromLevelId: null, toLevelId: "level-1", turns: 4 }],
      studentsPerTeacher: 5,
      teacherCapacity: 3,
      teacherJobId: "job-1",
    });
  });

  it("returns typed config for valid input", () => {
    expect(parseTierEducationConfig(VALID)).toEqual({
      levels: [
        { fromLevelId: null, toLevelId: "level-1", turns: 4 },
        { fromLevelId: "level-1", toLevelId: "level-2", turns: 6 },
      ],
      studentsPerTeacher: 5,
      teacherCapacity: 3,
      teacherJobId: "job-1",
    });
  });
});
