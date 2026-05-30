import { describe, expect, it } from "vitest";

import {
  createDepositTypeInputSchema,
  setDepositTypeActiveInputSchema,
  updateDepositTypeInputSchema,
  workerInputEntrySchema,
} from "./depositSchemas";

const DEPOSIT_TYPE_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";
const JOB_ID = "33333333-3333-3333-3333-333333333333";
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

describe("createDepositTypeInputSchema", () => {
  it("accepts a valid minimal input", () => {
    const result = createDepositTypeInputSchema.safeParse({
      jobId: JOB_ID,
      name: "Iron Ore Deposit",
      outputUnitsPerWorker: 3,
      slug: "iron-ore-deposit",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts input with workerInputsJson", () => {
    const result = createDepositTypeInputSchema.safeParse({
      jobId: JOB_ID,
      name: "Iron Ore Deposit",
      outputUnitsPerWorker: 3,
      slug: "iron-ore-deposit",
      workerInputsJson: [{ amountPerWorker: 1, resourceId: RESOURCE_ID }],
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts input with an empty workerInputsJson", () => {
    const result = createDepositTypeInputSchema.safeParse({
      jobId: JOB_ID,
      name: "Iron Ore Deposit",
      outputUnitsPerWorker: 3,
      slug: "iron-ore-deposit",
      workerInputsJson: [],
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a blank name", () => {
    const result = createDepositTypeInputSchema.safeParse({
      jobId: JOB_ID,
      name: "   ",
      outputUnitsPerWorker: 3,
      slug: "iron-ore-deposit",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a name that is too long", () => {
    const result = createDepositTypeInputSchema.safeParse({
      jobId: JOB_ID,
      name: "a".repeat(65),
      outputUnitsPerWorker: 3,
      slug: "iron-ore-deposit",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a blank slug", () => {
    const result = createDepositTypeInputSchema.safeParse({
      jobId: JOB_ID,
      name: "Iron Ore Deposit",
      outputUnitsPerWorker: 3,
      slug: "   ",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects outputUnitsPerWorker of zero", () => {
    const result = createDepositTypeInputSchema.safeParse({
      jobId: JOB_ID,
      name: "Iron Ore Deposit",
      outputUnitsPerWorker: 0,
      slug: "iron-ore-deposit",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects a non-integer outputUnitsPerWorker", () => {
    const result = createDepositTypeInputSchema.safeParse({
      jobId: JOB_ID,
      name: "Iron Ore Deposit",
      outputUnitsPerWorker: 2.5,
      slug: "iron-ore-deposit",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid jobId", () => {
    const result = createDepositTypeInputSchema.safeParse({
      jobId: "not-a-uuid",
      name: "Iron Ore Deposit",
      outputUnitsPerWorker: 3,
      slug: "iron-ore-deposit",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid worldId", () => {
    const result = createDepositTypeInputSchema.safeParse({
      jobId: JOB_ID,
      name: "Iron Ore Deposit",
      outputUnitsPerWorker: 3,
      slug: "iron-ore-deposit",
      worldId: "not-a-uuid",
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = createDepositTypeInputSchema.safeParse({
      extra: "field",
      jobId: JOB_ID,
      name: "Iron Ore Deposit",
      outputUnitsPerWorker: 3,
      slug: "iron-ore-deposit",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid workerInputsJson entry", () => {
    const result = createDepositTypeInputSchema.safeParse({
      jobId: JOB_ID,
      name: "Iron Ore Deposit",
      outputUnitsPerWorker: 3,
      slug: "iron-ore-deposit",
      workerInputsJson: [{ amountPerWorker: -1, resourceId: RESOURCE_ID }],
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

  it("accepts a partial update with only outputUnitsPerWorker", () => {
    const result = updateDepositTypeInputSchema.safeParse({
      depositTypeId: DEPOSIT_TYPE_ID,
      outputUnitsPerWorker: 5,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a partial update with only jobId", () => {
    const result = updateDepositTypeInputSchema.safeParse({
      depositTypeId: DEPOSIT_TYPE_ID,
      jobId: JOB_ID,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts a partial update with only workerInputsJson", () => {
    const result = updateDepositTypeInputSchema.safeParse({
      depositTypeId: DEPOSIT_TYPE_ID,
      workerInputsJson: [{ amountPerWorker: 2, resourceId: RESOURCE_ID }],
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
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

describe("setDepositTypeActiveInputSchema", () => {
  it("accepts a valid set-active request", () => {
    const result = setDepositTypeActiveInputSchema.safeParse({
      depositTypeId: DEPOSIT_TYPE_ID,
      isActive: true,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("accepts isActive: false", () => {
    const result = setDepositTypeActiveInputSchema.safeParse({
      depositTypeId: DEPOSIT_TYPE_ID,
      isActive: false,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(true);
  });

  it("rejects a non-boolean isActive", () => {
    const result = setDepositTypeActiveInputSchema.safeParse({
      depositTypeId: DEPOSIT_TYPE_ID,
      isActive: "true",
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects an invalid depositTypeId", () => {
    const result = setDepositTypeActiveInputSchema.safeParse({
      depositTypeId: "not-a-uuid",
      isActive: true,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });

  it("rejects unknown fields", () => {
    const result = setDepositTypeActiveInputSchema.safeParse({
      depositTypeId: DEPOSIT_TYPE_ID,
      extra: "field",
      isActive: true,
      worldId: WORLD_ID,
    });

    expect(result.success).toBe(false);
  });
});
