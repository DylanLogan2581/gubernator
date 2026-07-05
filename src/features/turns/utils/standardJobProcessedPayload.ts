// Payload shape for the standard_job.processed turn log category. This is a
// pure audit-log entry (no corresponding user notification), so unlike the
// other categories it isn't defined in the cross-runtime
// notificationPayloads.ts — it only ever needs parsing in the browser.

export type StandardJobProcessedPayload = {
  readonly inputsConsumed: Readonly<Record<string, number>>;
  readonly jobId: string;
  readonly outputsProduced: Readonly<Record<string, number>>;
  readonly scale: number;
  readonly settlementId: string;
  readonly workerCount: number;
};

function isNumberRecord(value: unknown): value is Record<string, number> {
  if (typeof value !== "object" || value === null) return false;
  return Object.values(value).every((v) => typeof v === "number");
}

export function parseStandardJobProcessedPayload(
  payload: unknown,
): StandardJobProcessedPayload | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as Record<string, unknown>;
  if (!isNumberRecord(p.inputsConsumed)) return null;
  if (typeof p.jobId !== "string") return null;
  if (!isNumberRecord(p.outputsProduced)) return null;
  if (typeof p.scale !== "number") return null;
  if (typeof p.settlementId !== "string") return null;
  if (typeof p.workerCount !== "number") return null;
  return {
    inputsConsumed: p.inputsConsumed,
    jobId: p.jobId,
    outputsProduced: p.outputsProduced,
    scale: p.scale,
    settlementId: p.settlementId,
    workerCount: p.workerCount,
  };
}
