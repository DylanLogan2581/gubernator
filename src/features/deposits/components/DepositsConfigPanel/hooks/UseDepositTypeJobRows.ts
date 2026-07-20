import { useCallback, useState } from "react";

import type { ResourceAmountEntry } from "@/components/shared/ResourceAmountListEditor";
import { generateLocalId } from "@/lib/uid";

export type DepositTypeJobRowState = {
  readonly localId: string;
  readonly jobId: string;
  readonly tierNumber: string;
  readonly outputUnitsPerWorker: string;
  readonly workerInputs: readonly ResourceAmountEntry[];
};

export function emptyDepositTypeJobRow(tierNumber = 1): DepositTypeJobRowState {
  return {
    localId: generateLocalId(),
    jobId: "",
    tierNumber: String(tierNumber),
    outputUnitsPerWorker: "1",
    workerInputs: [],
  };
}

// Repeatable job-row editor state for the create/edit deposit type forms
// (#1246): a deposit type now links 1..n jobs, each with its own output rate,
// tier number, and worker inputs (#1308). The DB only enforces uniqueness of
// jobId and tierNumber within a single deposit type's own job list
// (deposit_type_jobs_unique, deposit_type_jobs_tier_number_unique), not
// world-wide, so the only client-side conflicts to guard against here are
// duplicate jobIds/tierNumbers within this form's own rows.
export function useDepositTypeJobRows(
  initialRows?: readonly DepositTypeJobRowState[],
): {
  readonly rows: readonly DepositTypeJobRowState[];
  readonly addRow: () => void;
  readonly removeRow: (localId: string) => void;
  readonly updateRow: (
    localId: string,
    patch: Partial<Omit<DepositTypeJobRowState, "localId">>,
  ) => void;
  readonly duplicateJobIds: ReadonlySet<string>;
  readonly duplicateTierNumbers: ReadonlySet<string>;
} {
  const [rows, setRows] = useState<readonly DepositTypeJobRowState[]>(() =>
    initialRows !== undefined && initialRows.length > 0
      ? initialRows
      : [emptyDepositTypeJobRow()],
  );

  const addRow = useCallback((): void => {
    setRows((prev) => [...prev, emptyDepositTypeJobRow(prev.length + 1)]);
  }, []);

  const removeRow = useCallback((localId: string): void => {
    setRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((row) => row.localId !== localId),
    );
  }, []);

  const updateRow = useCallback(
    (
      localId: string,
      patch: Partial<Omit<DepositTypeJobRowState, "localId">>,
    ): void => {
      setRows((prev) =>
        prev.map((row) =>
          row.localId === localId ? { ...row, ...patch } : row,
        ),
      );
    },
    [],
  );

  const jobIdCounts = new Map<string, number>();
  for (const row of rows) {
    if (row.jobId === "") continue;
    jobIdCounts.set(row.jobId, (jobIdCounts.get(row.jobId) ?? 0) + 1);
  }
  const duplicateJobIds = new Set(
    [...jobIdCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([jobId]) => jobId),
  );

  const tierNumberCounts = new Map<string, number>();
  for (const row of rows) {
    if (row.tierNumber === "") continue;
    tierNumberCounts.set(
      row.tierNumber,
      (tierNumberCounts.get(row.tierNumber) ?? 0) + 1,
    );
  }
  const duplicateTierNumbers = new Set(
    [...tierNumberCounts.entries()]
      .filter(([, count]) => count > 1)
      .map(([tierNumber]) => tierNumber),
  );

  return {
    rows,
    addRow,
    removeRow,
    updateRow,
    duplicateJobIds,
    duplicateTierNumbers,
  };
}
