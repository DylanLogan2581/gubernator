import { describe, expect, it } from "vitest";

import {
  createJobInputSchema,
  hardDeleteJobInputSchema,
  jobIoEntrySchema,
  restoreJobInputSchema,
  softDeleteJobInputSchema,
  updateJobInputSchema,
} from "./jobSchemas";

const JOB_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";
const RESOURCE_ID = "33333333-3333-3333-3333-333333333333";
const DEPOSIT_TYPE_ID = "44444444-4444-4444-4444-444444444444";
const MANAGED_POP_TYPE_ID = "55555555-5555-5555-5555-555555555555";

describe("jobIoEntrySchema", () => {
  it("accepts a valid entry with all fields", () => {
    const result = jobIoEntrySchema.safeParse({
      amountPerWorker: 2.5,
      notes: "optional note",
      resourceId: RESOURCE_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a valid entry without notes", () => {
    const result = jobIoEntrySchema.safeParse({
      amountPerWorker: 1,
      resourceId: RESOURCE_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts zero amountPerWorker", () => {
    const result = jobIoEntrySchema.safeParse({
      amountPerWorker: 0,
      resourceId: RESOURCE_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects negative amountPerWorker", () => {
    const result = jobIoEntrySchema.safeParse({
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
    const result = jobIoEntrySchema.safeParse({
      amountPerWorker: 1,
      resourceId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = jobIoEntrySchema.safeParse({
      amountPerWorker: 1,
      extra: "field",
      resourceId: RESOURCE_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("createJobInputSchema — discrimination", () => {
  it("accepts a valid standard job", () => {
    const result = createJobInputSchema.safeParse({
      baseCapacity: 10,
      jobType: "standard",
      name: "Farm Worker",
      slug: "farm-worker",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.jobType).toBe("standard");
    }
  });

  it("accepts a valid construction job", () => {
    const result = createJobInputSchema.safeParse({
      baseCapacity: 5,
      jobType: "construction",
      name: "Builder",
      slug: "builder",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.jobType).toBe("construction");
    }
  });

  it("accepts a valid trader job", () => {
    const result = createJobInputSchema.safeParse({
      jobType: "trader",
      name: "Merchant",
      slug: "merchant",
      traderCapacityPerWorker: 3,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.jobType).toBe("trader");
    }
  });

  it("accepts a valid deposit job", () => {
    const result = createJobInputSchema.safeParse({
      jobType: "deposit",
      linkedDepositTypeId: DEPOSIT_TYPE_ID,
      name: "Miner",
      slug: "miner",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.jobType).toBe("deposit");
    }
  });

  it("accepts a valid husbandry job", () => {
    const result = createJobInputSchema.safeParse({
      jobType: "husbandry",
      linkedManagedPopulationTypeId: MANAGED_POP_TYPE_ID,
      name: "Herdsman",
      slug: "herdsman",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.jobType).toBe("husbandry");
    }
  });

  it("accepts a valid culling job", () => {
    const result = createJobInputSchema.safeParse({
      jobType: "culling",
      linkedManagedPopulationTypeId: MANAGED_POP_TYPE_ID,
      name: "Hunter",
      slug: "hunter",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.jobType).toBe("culling");
    }
  });

  it("rejects an unknown job type", () => {
    const result = createJobInputSchema.safeParse({
      jobType: "unknown",
      name: "Unknown",
      slug: "unknown",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("createJobInputSchema — type-specific optional fields", () => {
  it("accepts a standard job without baseCapacity", () => {
    const result = createJobInputSchema.safeParse({
      jobType: "standard",
      name: "Farm Worker",
      slug: "farm-worker",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a construction job without baseCapacity", () => {
    const result = createJobInputSchema.safeParse({
      jobType: "construction",
      name: "Builder",
      slug: "builder",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a trader job without traderCapacityPerWorker", () => {
    const result = createJobInputSchema.safeParse({
      jobType: "trader",
      name: "Merchant",
      slug: "merchant",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a deposit job without linkedDepositTypeId", () => {
    const result = createJobInputSchema.safeParse({
      jobType: "deposit",
      name: "Miner",
      slug: "miner",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a husbandry job without linkedManagedPopulationTypeId", () => {
    const result = createJobInputSchema.safeParse({
      jobType: "husbandry",
      name: "Herdsman",
      slug: "herdsman",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a culling job without linkedManagedPopulationTypeId", () => {
    const result = createJobInputSchema.safeParse({
      jobType: "culling",
      name: "Hunter",
      slug: "hunter",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a standard job with a non-integer baseCapacity", () => {
    const result = createJobInputSchema.safeParse({
      baseCapacity: 3.5,
      jobType: "standard",
      name: "Farm Worker",
      slug: "farm-worker",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a deposit job that also includes baseCapacity (unknown field on strict object)", () => {
    const result = createJobInputSchema.safeParse({
      baseCapacity: 5,
      jobType: "deposit",
      linkedDepositTypeId: DEPOSIT_TYPE_ID,
      name: "Miner",
      slug: "miner",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("createJobInputSchema — common field validation", () => {
  it("rejects a blank name", () => {
    const result = createJobInputSchema.safeParse({
      baseCapacity: 10,
      jobType: "standard",
      name: "   ",
      slug: "farm-worker",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a name that is too long", () => {
    const result = createJobInputSchema.safeParse({
      baseCapacity: 10,
      jobType: "standard",
      name: "a".repeat(65),
      slug: "farm-worker",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a blank slug", () => {
    const result = createJobInputSchema.safeParse({
      baseCapacity: 10,
      jobType: "standard",
      name: "Farm Worker",
      slug: "   ",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid worldId", () => {
    const result = createJobInputSchema.safeParse({
      baseCapacity: 10,
      jobType: "standard",
      name: "Farm Worker",
      slug: "farm-worker",
      worldId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("accepts inputsJson and outputsJson with valid entries", () => {
    const result = createJobInputSchema.safeParse({
      baseCapacity: 10,
      inputsJson: [{ amountPerWorker: 1, resourceId: RESOURCE_ID }],
      jobType: "standard",
      name: "Farm Worker",
      outputsJson: [
        { amountPerWorker: 2, notes: "grain", resourceId: RESOURCE_ID },
      ],
      slug: "farm-worker",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects inputsJson with an invalid entry", () => {
    const result = createJobInputSchema.safeParse({
      baseCapacity: 10,
      inputsJson: [{ amountPerWorker: -1, resourceId: RESOURCE_ID }],
      jobType: "standard",
      name: "Farm Worker",
      slug: "farm-worker",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("updateJobInputSchema", () => {
  it("accepts a partial update with only name", () => {
    const result = updateJobInputSchema.safeParse({
      jobId: JOB_ID,
      name: "Updated Name",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a partial update with only baseCapacity", () => {
    const result = updateJobInputSchema.safeParse({
      baseCapacity: 20,
      jobId: JOB_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a partial update with only inputsJson", () => {
    const result = updateJobInputSchema.safeParse({
      inputsJson: [{ amountPerWorker: 1, resourceId: RESOURCE_ID }],
      jobId: JOB_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts setting linkedDepositTypeId to null", () => {
    const result = updateJobInputSchema.safeParse({
      jobId: JOB_ID,
      linkedDepositTypeId: null,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an update with no updatable fields", () => {
    const result = updateJobInputSchema.safeParse({
      jobId: JOB_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.name).toContain(
        "At least one field must be provided.",
      );
    }
  });

  it("rejects an invalid jobId", () => {
    const result = updateJobInputSchema.safeParse({
      jobId: "not-a-uuid",
      name: "Updated Name",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = updateJobInputSchema.safeParse({
      jobId: JOB_ID,
      name: "Updated Name",
      unknownField: "value",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("softDeleteJobInputSchema", () => {
  it("accepts a valid request", () => {
    const result = softDeleteJobInputSchema.safeParse({
      jobId: JOB_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid jobId", () => {
    const result = softDeleteJobInputSchema.safeParse({
      jobId: "not-a-uuid",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = softDeleteJobInputSchema.safeParse({
      extra: "field",
      jobId: JOB_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("restoreJobInputSchema", () => {
  it("accepts a valid request", () => {
    const result = restoreJobInputSchema.safeParse({
      jobId: JOB_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid jobId", () => {
    const result = restoreJobInputSchema.safeParse({
      jobId: "not-a-uuid",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});

describe("hardDeleteJobInputSchema", () => {
  it("accepts a valid request", () => {
    const result = hardDeleteJobInputSchema.safeParse({
      jobId: JOB_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects an invalid jobId", () => {
    const result = hardDeleteJobInputSchema.safeParse({
      jobId: "not-a-uuid",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});
