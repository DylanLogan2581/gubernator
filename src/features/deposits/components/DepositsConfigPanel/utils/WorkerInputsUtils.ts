import type { ResourceAmountEntry } from "@/components/shared/ResourceAmountListEditor";
import { generateLocalId } from "@/lib/uid";

export type WorkerInputJson = {
  readonly amountPerWorker: number;
  readonly resourceId: string;
};

/**
 * Convert ResourceAmountEntry array to JSON format for API submission.
 * Returns undefined if array is empty.
 */
export function toWorkerInputsJson(
  entries: readonly ResourceAmountEntry[],
): WorkerInputJson[] | undefined {
  if (entries.length === 0) {
    return undefined;
  }
  return entries.map((e) => ({
    amountPerWorker: parseFloat(e.amount),
    resourceId: e.resourceId,
  }));
}

/**
 * Convert JSON format to ResourceAmountEntry array for form editing.
 */
export function toWorkerInputsEntries(
  json: readonly WorkerInputJson[],
): ResourceAmountEntry[] {
  return json.map((e) => ({
    amount: String(e.amountPerWorker),
    id: generateLocalId(),
    resourceId: e.resourceId,
  }));
}
