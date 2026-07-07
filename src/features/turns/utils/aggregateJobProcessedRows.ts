// Client-side grouping of standard_job.processed rows into one summary row
// per (turn, settlement). The category fires once per active job every turn
// it processes, so a busy settlement can produce dozens of near-identical
// rows; collapsing them keeps the log readable without losing the detail —
// the summary row's `entries` retain everything needed for an expanded
// per-job breakdown.

import { parseStandardJobProcessedPayload } from "./standardJobProcessedPayload";

import type { TurnLogBrowserEntry } from "../queries/turnLogBrowserQueries";

export type TurnLogRow =
  | { readonly kind: "entry"; readonly entry: TurnLogBrowserEntry }
  | {
      readonly kind: "job-summary";
      readonly count: number;
      readonly entries: readonly TurnLogBrowserEntry[];
      readonly id: string;
      // First entry in the group — carries the turn/settlement/nation fields
      // needed to render the Turn and Scope columns the same way a plain
      // entry row does.
      readonly representativeEntry: TurnLogBrowserEntry;
    }
  | {
      readonly kind: "category-summary";
      readonly count: number;
      readonly entries: readonly TurnLogBrowserEntry[];
      readonly id: string;
      readonly logCategory: string;
      readonly representativeEntry: TurnLogBrowserEntry;
    };

export function aggregateJobProcessedRows(
  entries: readonly TurnLogBrowserEntry[],
): readonly TurnLogRow[] {
  const rows: TurnLogRow[] = [];
  const groupIndexByKey = new Map<string, number>();

  for (const entry of entries) {
    if (entry.logCategory === "standard_job.processed") {
      const key = `job:${String(entry.toTurnNumber)}:${entry.settlementId ?? "none"}`;
      const existingIndex = groupIndexByKey.get(key);

      if (existingIndex === undefined) {
        groupIndexByKey.set(key, rows.length);
        rows.push({
          kind: "job-summary",
          count: 1,
          entries: [entry],
          id: `job-summary:${key}`,
          representativeEntry: entry,
        });
        continue;
      }

      const existing = rows[existingIndex];
      if (existing.kind === "job-summary") {
        rows[existingIndex] = {
          ...existing,
          count: existing.count + 1,
          entries: [...existing.entries, entry],
        };
      }
      continue;
    }

    // Generic grouping: any other category repeated within the same turn
    // and scope collapses into a "category-summary" row with a count
    // (e.g. "Passive Effect Applied ×12"), so a busy turn doesn't drown the
    // log in near-identical rows. Single occurrences stay as plain entries.
    const key = `cat:${entry.logCategory}:${String(entry.toTurnNumber)}:${entry.settlementId ?? "none"}:${entry.nationId ?? "none"}:${entry.citizenId ?? "none"}`;
    const existingIndex = groupIndexByKey.get(key);

    if (existingIndex === undefined) {
      groupIndexByKey.set(key, rows.length);
      rows.push({ kind: "entry", entry });
      continue;
    }

    const existing = rows[existingIndex];
    if (existing.kind === "entry") {
      rows[existingIndex] = {
        kind: "category-summary",
        count: 2,
        entries: [existing.entry, entry],
        id: `category-summary:${key}`,
        logCategory: entry.logCategory,
        representativeEntry: existing.entry,
      };
    } else if (existing.kind === "category-summary") {
      rows[existingIndex] = {
        ...existing,
        count: existing.count + 1,
        entries: [...existing.entries, entry],
      };
    }
  }

  return rows;
}

export type JobBreakdownRow = {
  readonly inputsConsumed: Readonly<Record<string, number>>;
  readonly jobId: string;
  readonly outputsProduced: Readonly<Record<string, number>>;
  readonly workerCount: number;
};

// Sums worker counts and resource deltas per job across the group's entries,
// for the expanded detail view — strictly more information than the "N jobs
// processed" summary.
export function summarizeJobBreakdown(
  entries: readonly TurnLogBrowserEntry[],
): readonly JobBreakdownRow[] {
  const byJob = new Map<string, JobBreakdownRow>();

  for (const entry of entries) {
    const payload = parseStandardJobProcessedPayload(entry.payloadJsonb);
    if (payload === null) continue;

    const existing = byJob.get(payload.jobId);
    if (existing === undefined) {
      byJob.set(payload.jobId, {
        inputsConsumed: { ...payload.inputsConsumed },
        jobId: payload.jobId,
        outputsProduced: { ...payload.outputsProduced },
        workerCount: payload.workerCount,
      });
      continue;
    }

    byJob.set(payload.jobId, {
      inputsConsumed: mergeSums(
        existing.inputsConsumed,
        payload.inputsConsumed,
      ),
      jobId: payload.jobId,
      outputsProduced: mergeSums(
        existing.outputsProduced,
        payload.outputsProduced,
      ),
      workerCount: existing.workerCount + payload.workerCount,
    });
  }

  return [...byJob.values()];
}

function mergeSums(
  a: Readonly<Record<string, number>>,
  b: Readonly<Record<string, number>>,
): Record<string, number> {
  const merged: Record<string, number> = { ...a };
  for (const [resourceId, amount] of Object.entries(b)) {
    merged[resourceId] = (merged[resourceId] ?? 0) + amount;
  }
  return merged;
}
