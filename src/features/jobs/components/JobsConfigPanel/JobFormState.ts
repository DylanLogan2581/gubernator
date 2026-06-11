import type { ResourceAmountEntry } from "@/components/shared/ResourceAmountListEditor";
import { generateLocalId } from "@/lib/uid";

import type { JobIoEntry } from "../../types/jobTypes";

// Row type for the IO editor — uses raw string amounts to allow intermediate
// invalid states that Zod catches on submit.
export function entryToRow(entry: JobIoEntry): ResourceAmountEntry {
  return {
    amount: String(entry.amountPerWorker),
    id: generateLocalId(),
    notes: entry.notes ?? "",
    resourceId: entry.resourceId,
  };
}

export function rowToEntry(row: ResourceAmountEntry): {
  amountPerWorker: number;
  notes?: string;
  resourceId: string;
} {
  return {
    amountPerWorker: parseFloat(row.amount),
    ...(row.notes !== undefined && row.notes.trim() !== ""
      ? { notes: row.notes.trim() }
      : {}),
    resourceId: row.resourceId,
  };
}

export type FieldErrors = {
  readonly baseCapacity?: string;
  readonly inputsJson?: string;
  readonly name?: string;
  readonly outputsJson?: string;
  readonly slug?: string;
  readonly traderCapacityPerWorker?: string;
};
