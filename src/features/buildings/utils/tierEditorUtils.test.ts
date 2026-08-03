import { describe, expect, it } from "vitest";

import {
  buildEffectInputs,
  tierEffectsToState,
  type EffectRowState,
} from "./tierEditorUtils";

const JOB_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const RESOURCE_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const ROW_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const LEVEL_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const LEVEL_ID_2 = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";

function makeRow(overrides: Partial<EffectRowState>): EffectRowState {
  return {
    amount: "5",
    effectType: "",
    id: ROW_ID,
    jobId: "",
    levels: [],
    resourceId: "",
    studentsPerTeacher: "",
    teacherCapacity: "",
    teacherJobId: "",
    ...overrides,
  };
}

describe("buildEffectInputs", () => {
  it("maps job_capacity_increase", () => {
    const result = buildEffectInputs([
      makeRow({ effectType: "job_capacity_increase", jobId: JOB_ID }),
    ]);

    expect(result).toEqual([
      { amount: 5, jobId: JOB_ID, type: "job_capacity_increase" },
    ]);
  });

  it("maps passive_resource_production", () => {
    const result = buildEffectInputs([
      makeRow({
        effectType: "passive_resource_production",
        resourceId: RESOURCE_ID,
      }),
    ]);

    expect(result).toEqual([
      {
        amount: 5,
        resourceId: RESOURCE_ID,
        type: "passive_resource_production",
      },
    ]);
  });

  it("maps resource_storage_increase", () => {
    const result = buildEffectInputs([
      makeRow({
        effectType: "resource_storage_increase",
        resourceId: RESOURCE_ID,
      }),
    ]);

    expect(result).toEqual([
      {
        amount: 5,
        resourceId: RESOURCE_ID,
        type: "resource_storage_increase",
      },
    ]);
  });

  it("maps population_cap_increase", () => {
    const result = buildEffectInputs([
      makeRow({ effectType: "population_cap_increase" }),
    ]);

    expect(result).toEqual([{ amount: 5, type: "population_cap_increase" }]);
  });

  it("maps education, converting an empty fromLevelId to null", () => {
    const result = buildEffectInputs([
      makeRow({
        effectType: "education",
        levels: [
          { fromLevelId: "", id: "l1", toLevelId: LEVEL_ID, turns: "3" },
          {
            fromLevelId: LEVEL_ID,
            id: "l2",
            toLevelId: LEVEL_ID_2,
            turns: "4",
          },
        ],
        studentsPerTeacher: "5",
        teacherCapacity: "2",
        teacherJobId: JOB_ID,
      }),
    ]);

    expect(result).toEqual([
      {
        levels: [
          { fromLevelId: null, toLevelId: LEVEL_ID, turns: 3 },
          { fromLevelId: LEVEL_ID, toLevelId: LEVEL_ID_2, turns: 4 },
        ],
        studentsPerTeacher: 5,
        teacherCapacity: 2,
        teacherJobId: JOB_ID,
        type: "education",
      },
    ]);
  });

  it("defaults empty education numeric strings to 0", () => {
    const result = buildEffectInputs([
      makeRow({
        effectType: "education",
        levels: [{ fromLevelId: "", id: "l1", toLevelId: LEVEL_ID, turns: "" }],
        studentsPerTeacher: "",
        teacherCapacity: "",
        teacherJobId: JOB_ID,
      }),
    ]);

    expect(result).toEqual([
      {
        levels: [{ fromLevelId: null, toLevelId: LEVEL_ID, turns: 0 }],
        studentsPerTeacher: 0,
        teacherCapacity: 0,
        teacherJobId: JOB_ID,
        type: "education",
      },
    ]);
  });

  it("skips rows with empty effectType", () => {
    const result = buildEffectInputs([makeRow({ effectType: "" })]);

    expect(result).toHaveLength(0);
  });

  it("defaults empty amount string to 0", () => {
    const result = buildEffectInputs([
      makeRow({ amount: "", effectType: "population_cap_increase" }),
    ]);

    expect(result).toEqual([{ amount: 0, type: "population_cap_increase" }]);
  });

  it("handles mixed rows, skipping incomplete ones", () => {
    const result = buildEffectInputs([
      makeRow({ effectType: "population_cap_increase" }),
      makeRow({ effectType: "" }),
      makeRow({ effectType: "job_capacity_increase", jobId: JOB_ID }),
    ]);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ amount: 5, type: "population_cap_increase" });
    expect(result[1]).toEqual({
      amount: 5,
      jobId: JOB_ID,
      type: "job_capacity_increase",
    });
  });
});

describe("tierEffectsToState", () => {
  it("converts job_capacity_increase", () => {
    const rows = tierEffectsToState([
      { amount: 3, jobId: JOB_ID, type: "job_capacity_increase" },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      amount: "3",
      effectType: "job_capacity_increase",
      jobId: JOB_ID,
      resourceId: "",
    });
  });

  it("converts passive_resource_production", () => {
    const rows = tierEffectsToState([
      {
        amount: 10,
        resourceId: RESOURCE_ID,
        type: "passive_resource_production",
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      amount: "10",
      effectType: "passive_resource_production",
      jobId: "",
      resourceId: RESOURCE_ID,
    });
  });

  it("converts resource_storage_increase", () => {
    const rows = tierEffectsToState([
      {
        amount: 50,
        resourceId: RESOURCE_ID,
        type: "resource_storage_increase",
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      amount: "50",
      effectType: "resource_storage_increase",
      jobId: "",
      resourceId: RESOURCE_ID,
    });
  });

  it("converts population_cap_increase", () => {
    const rows = tierEffectsToState([
      { amount: 100, type: "population_cap_increase" },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      amount: "100",
      effectType: "population_cap_increase",
      jobId: "",
      resourceId: "",
    });
  });

  it("converts education, mapping a null fromLevelId to an empty string", () => {
    const rows = tierEffectsToState([
      {
        levels: [
          { fromLevelId: null, toLevelId: LEVEL_ID, turns: 3 },
          { fromLevelId: LEVEL_ID, toLevelId: LEVEL_ID_2, turns: 4 },
        ],
        studentsPerTeacher: 5,
        teacherCapacity: 2,
        teacherJobId: JOB_ID,
        type: "education",
      },
    ]);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      effectType: "education",
      levels: [
        { fromLevelId: "", toLevelId: LEVEL_ID, turns: "3" },
        { fromLevelId: LEVEL_ID, toLevelId: LEVEL_ID_2, turns: "4" },
      ],
      studentsPerTeacher: "5",
      teacherCapacity: "2",
      teacherJobId: JOB_ID,
    });
  });

  it("assigns a unique id to each row", () => {
    const rows = tierEffectsToState([
      { amount: 1, type: "population_cap_increase" },
      { amount: 2, type: "population_cap_increase" },
    ]);

    expect(rows[0].id).toBeTruthy();
    expect(rows[1].id).toBeTruthy();
    expect(rows[0].id).not.toBe(rows[1].id);
  });

  it("throws for an unrecognized effect type", () => {
    const bogusEffect = {
      amount: 1,
      type: "unknown_effect_type",
    } as unknown as Parameters<typeof tierEffectsToState>[0][number];

    expect(() => tierEffectsToState([bogusEffect])).toThrow(
      "Unknown effect type: unknown_effect_type",
    );
  });
});
