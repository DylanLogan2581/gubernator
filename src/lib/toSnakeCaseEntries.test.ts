import { describe, expect, it } from "vitest";

import { toSnakeCaseEntries } from "./toSnakeCaseEntries";

type SimpleEntry = { readonly amount: number; readonly resourceId: string };
type OptionalEntry = {
  readonly amountPerWorker: number;
  readonly notes?: string;
  readonly resourceId: string;
};

describe("toSnakeCaseEntries", () => {
  it("returns an empty array when entries is empty", () => {
    expect(
      toSnakeCaseEntries<SimpleEntry>([], {
        amount: "amount",
        resourceId: "resource_id",
      }),
    ).toEqual([]);
  });

  it("maps all required fields to their snake_case keys", () => {
    const entries: SimpleEntry[] = [
      { amount: 5, resourceId: "r1" },
      { amount: 10, resourceId: "r2" },
    ];
    expect(
      toSnakeCaseEntries(entries, {
        amount: "amount",
        resourceId: "resource_id",
      }),
    ).toEqual([
      { amount: 5, resource_id: "r1" },
      { amount: 10, resource_id: "r2" },
    ]);
  });

  it("includes an optional field when it is defined", () => {
    const entries: OptionalEntry[] = [
      { amountPerWorker: 3, notes: "extra", resourceId: "r1" },
    ];
    expect(
      toSnakeCaseEntries(entries, {
        amountPerWorker: "amount_per_worker",
        notes: "notes",
        resourceId: "resource_id",
      }),
    ).toEqual([{ amount_per_worker: 3, notes: "extra", resource_id: "r1" }]);
  });

  it("omits an optional field when it is undefined", () => {
    const entries: OptionalEntry[] = [{ amountPerWorker: 3, resourceId: "r1" }];
    const result = toSnakeCaseEntries(entries, {
      amountPerWorker: "amount_per_worker",
      notes: "notes",
      resourceId: "resource_id",
    }) as Record<string, unknown>[];
    expect(result).toHaveLength(1);
    expect(result[0]).not.toHaveProperty("notes");
  });

  it("handles multiple entries with mixed optional field presence", () => {
    const entries: OptionalEntry[] = [
      { amountPerWorker: 1, notes: "a", resourceId: "r1" },
      { amountPerWorker: 2, resourceId: "r2" },
    ];
    const result = toSnakeCaseEntries(entries, {
      amountPerWorker: "amount_per_worker",
      notes: "notes",
      resourceId: "resource_id",
    }) as Record<string, unknown>[];
    expect(result[0]).toEqual({
      amount_per_worker: 1,
      notes: "a",
      resource_id: "r1",
    });
    expect(result[1]).toEqual({ amount_per_worker: 2, resource_id: "r2" });
    expect(result[1]).not.toHaveProperty("notes");
  });
});
