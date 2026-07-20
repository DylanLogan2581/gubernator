import { describe, expect, it } from "vitest";

import {
  createDepositTypeInputSchema,
  depositTypeJobSchema,
  hardDeleteDepositTypeInputSchema,
  restoreDepositTypeInputSchema,
  softDeleteDepositTypeInputSchema,
  updateDepositTypeInputSchema,
  workerInputEntrySchema,
} from "./depositSchemas";

const DEPOSIT_TYPE_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";
const JOB_ID = "33333333-3333-3333-3333-333333333333";
const JOB_ID_2 = "55555555-5555-5555-5555-555555555555";
const RESOURCE_ID = "44444444-4444-4444-4444-444444444444";

describe("workerInputEntrySchema", () => {
  it("accepts a valid entry", () => {
    const result = workerInputEntrySchema.safeParse({
      amountPerWorker: 2.5,
      resourceId: RESOURCE_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts zero amountPerWorker", () => {
    const result = workerInputEntrySchema.safeParse({
      amountPerWorker: 0,
      resourceId: RESOURCE_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects negative amountPerWorker", () => {
    const result = workerInputEntrySchema.safeParse({
      amountPerWorker: -1,
      resourceId: RESOURCE_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.amountPerWorker).toContain(
        "Amount per worker must be non-negative.",
      );
    }
  });

  it("rejects an invalid resourceId", () => {
    const result = workerInputEntrySchema.safeParse({
      amountPerWorker: 1,
      resourceId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = workerInputEntrySchema.safeParse({
      amountPerWorker: 1,
      extra: "field",
      resourceId: RESOURCE_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("depositTypeJobSchema", () => {
  it("accepts a valid job entry", () => {
    const result = depositTypeJobSchema.safeParse({
      jobId: JOB_ID,
      tierNumber: 1,
      outputUnitsPerWorker: 3,
      workerInputsJson: [],
    });

    expect(result.success).toBe(true);
  });

  it("rejects outputUnitsPerWorker of zero", () => {
    const result = depositTypeJobSchema.safeParse({
      jobId: JOB_ID,
      tierNumber: 1,
      outputUnitsPerWorker: 0,
      workerInputsJson: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-integer outputUnitsPerWorker", () => {
    const result = depositTypeJobSchema.safeParse({
      jobId: JOB_ID,
      tierNumber: 1,
      outputUnitsPerWorker: 2.5,
      workerInputsJson: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid jobId", () => {
    const result = depositTypeJobSchema.safeParse({
      jobId: "not-a-uuid",
      tierNumber: 1,
      outputUnitsPerWorker: 3,
      workerInputsJson: [],
    });

    expect(result.success).toBe(false);
  });

  it("rejects a tierNumber below 1", () => {
    const result = depositTypeJobSchema.safeParse({
      jobId: JOB_ID,
      tierNumber: 0,
      outputUnitsPerWorker: 3,
      workerInputsJson: [],
    });

    expect(result.success).toBe(false);
  });
});

describe("createDepositTypeInputSchema", () => {
  function validJob(
    overrides: Partial<{
      jobId: string;
      tierNumber: number;
      outputUnitsPerWorker: number;
      workerInputsJson: { amountPerWorker: number; resourceId: string }[];
    }> = {},
  ): {
    jobId: string;
    tierNumber: number;
    outputUnitsPerWorker: number;
    workerInputsJson: { amountPerWorker: number; resourceId: string }[];
  } {
    return {
      jobId: JOB_ID,
      tierNumber: 1,
      outputUnitsPerWorker: 3,
      workerInputsJson: [],
      ...overrides,
    };
  }

  it("accepts a valid minimal input with one job", () => {
    const result = createDepositTypeInputSchema.safeParse({
      jobs: [validJob()],
      name: "Iron Ore Deposit",
      slug: "iron-ore-deposit",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts input with multiple jobs", () => {
    const result = createDepositTypeInputSchema.safeParse({
      jobs: [
        validJob({ jobId: JOB_ID }),
        validJob({
          jobId: JOB_ID_2,
          tierNumber: 2,
          outputUnitsPerWorker: 5,
          workerInputsJson: [{ amountPerWorker: 1, resourceId: RESOURCE_ID }],
        }),
      ],
      name: "Iron Ore Deposit",
      slug: "iron-ore-deposit",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty jobs array", () => {
    const result = createDepositTypeInputSchema.safeParse({
      jobs: [],
      name: "Iron Ore Deposit",
      slug: "iron-ore-deposit",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate jobIds within the jobs array", () => {
    const result = createDepositTypeInputSchema.safeParse({
      jobs: [
        validJob({ jobId: JOB_ID, tierNumber: 1 }),
        validJob({ jobId: JOB_ID, tierNumber: 2 }),
      ],
      name: "Iron Ore Deposit",
      slug: "iron-ore-deposit",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate tierNumbers within the jobs array", () => {
    const result = createDepositTypeInputSchema.safeParse({
      jobs: [
        validJob({ jobId: JOB_ID, tierNumber: 1 }),
        validJob({ jobId: JOB_ID_2, tierNumber: 1 }),
      ],
      name: "Iron Ore Deposit",
      slug: "iron-ore-deposit",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a blank name", () => {
    const result = createDepositTypeInputSchema.safeParse({
      jobs: [validJob()],
      name: "   ",
      slug: "iron-ore-deposit",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a name that is too long", () => {
    const result = createDepositTypeInputSchema.safeParse({
      jobs: [validJob()],
      name: "a".repeat(65),
      slug: "iron-ore-deposit",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a blank slug", () => {
    const result = createDepositTypeInputSchema.safeParse({
      jobs: [validJob()],
      name: "Iron Ore Deposit",
      slug: "   ",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid worldId", () => {
    const result = createDepositTypeInputSchema.safeParse({
      jobs: [validJob()],
      name: "Iron Ore Deposit",
      slug: "iron-ore-deposit",
      worldId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = createDepositTypeInputSchema.safeParse({
      extra: "field",
      jobs: [validJob()],
      name: "Iron Ore Deposit",
      slug: "iron-ore-deposit",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid workerInputsJson entry within a job", () => {
    const result = createDepositTypeInputSchema.safeParse({
      jobs: [
        validJob({
          workerInputsJson: [{ amountPerWorker: -1, resourceId: RESOURCE_ID }],
        }),
      ],
      name: "Iron Ore Deposit",
      slug: "iron-ore-deposit",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("updateDepositTypeInputSchema", () => {
  it("accepts a partial update with only name", () => {
    const result = updateDepositTypeInputSchema.safeParse({
      depositTypeId: DEPOSIT_TYPE_ID,
      name: "Updated Name",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a partial update with only slug", () => {
    const result = updateDepositTypeInputSchema.safeParse({
      depositTypeId: DEPOSIT_TYPE_ID,
      slug: "updated-slug",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a partial update with only jobs", () => {
    const result = updateDepositTypeInputSchema.safeParse({
      depositTypeId: DEPOSIT_TYPE_ID,
      jobs: [
        {
          jobId: JOB_ID,
          tierNumber: 1,
          outputUnitsPerWorker: 5,
          workerInputsJson: [],
        },
      ],
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty jobs array on update", () => {
    const result = updateDepositTypeInputSchema.safeParse({
      depositTypeId: DEPOSIT_TYPE_ID,
      jobs: [],
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an update with no updatable fields", () => {
    const result = updateDepositTypeInputSchema.safeParse({
      depositTypeId: DEPOSIT_TYPE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain(
        "At least one field must be provided.",
      );
    }
  });

  it("rejects an invalid depositTypeId", () => {
    const result = updateDepositTypeInputSchema.safeParse({
      depositTypeId: "not-a-uuid",
      name: "Updated Name",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = updateDepositTypeInputSchema.safeParse({
      depositTypeId: DEPOSIT_TYPE_ID,
      name: "Updated Name",
      unknownField: "value",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("softDeleteDepositTypeInputSchema", () => {
  it("accepts a valid request", () => {
    const result = softDeleteDepositTypeInputSchema.safeParse({
      depositTypeId: DEPOSIT_TYPE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid depositTypeId", () => {
    const result = softDeleteDepositTypeInputSchema.safeParse({
      depositTypeId: "not-a-uuid",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = softDeleteDepositTypeInputSchema.safeParse({
      depositTypeId: DEPOSIT_TYPE_ID,
      extra: "field",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("restoreDepositTypeInputSchema", () => {
  it("accepts a valid request", () => {
    const result = restoreDepositTypeInputSchema.safeParse({
      depositTypeId: DEPOSIT_TYPE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid depositTypeId", () => {
    const result = restoreDepositTypeInputSchema.safeParse({
      depositTypeId: "not-a-uuid",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("hardDeleteDepositTypeInputSchema", () => {
  it("accepts a valid request", () => {
    const result = hardDeleteDepositTypeInputSchema.safeParse({
      depositTypeId: DEPOSIT_TYPE_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid depositTypeId", () => {
    const result = hardDeleteDepositTypeInputSchema.safeParse({
      depositTypeId: "not-a-uuid",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});
