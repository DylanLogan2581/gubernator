import { describe, expect, it } from "vitest";

import {
  buildEffectInputs,
  tierEffectsToState,
  type EffectRowState,
} from "./tierEditorUtils";

const JOB_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const RESOURCE_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const ROW_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

function makeRow(overrides: Partial<EffectRowState>): EffectRowState {
  return {
    amount: "5",
    effectType: "",
    id: ROW_ID,
    jobId: "",
    resourceId: "",
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

  it("assigns a unique id to each row", () => {
    const rows = tierEffectsToState([
      { amount: 1, type: "population_cap_increase" },
      { amount: 2, type: "population_cap_increase" },
    ]);

    expect(rows[0].id).toBeTruthy();
    expect(rows[1].id).toBeTruthy();
    expect(rows[0].id).not.toBe(rows[1].id);
  });
});
