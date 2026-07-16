import { useCallback, useState } from "react";

import { generateLocalId } from "@/lib/uid";

export type ManagedPopulationJobRowState = {
  readonly localId: string;
  readonly jobId: string;
  readonly rateValue: string;
};

export function emptyManagedPopulationJobRow(
  initialRateValue: string,
): ManagedPopulationJobRowState {
  return {
    localId: generateLocalId(),
    jobId: "",
    rateValue: initialRateValue,
  };
}

// Repeatable job-row editor state shared by the husbandry and culling job
// sections of the create/edit population type forms (#1247): a population
// type now links 1..n jobs per purpose, each with its own rate (workers per
// N animals for husbandry, max cull per worker for culling). The DB only
// enforces uniqueness of jobId within a single population type's own job
// list per purpose (managed_population_husbandry_jobs_unique /
// managed_population_culling_jobs_unique), not world-wide, so the only
// client-side conflict to guard against here is a duplicate jobId within
// this form's own rows of the same purpose.
export function useManagedPopulationJobRows(
  initialRows?: readonly ManagedPopulationJobRowState[],
  defaultRateValue = "1",
): {
  readonly rows: readonly ManagedPopulationJobRowState[];
  readonly addRow: () => void;
  readonly removeRow: (localId: string) => void;
  readonly updateRow: (
    localId: string,
    patch: Partial<Omit<ManagedPopulationJobRowState, "localId">>,
  ) => void;
  readonly duplicateJobIds: ReadonlySet<string>;
} {
  const [rows, setRows] = useState<readonly ManagedPopulationJobRowState[]>(
    () =>
      initialRows !== undefined && initialRows.length > 0
        ? initialRows
        : [emptyManagedPopulationJobRow(defaultRateValue)],
  );

  const addRow = useCallback((): void => {
    setRows((prev) => [
      ...prev,
      emptyManagedPopulationJobRow(defaultRateValue),
    ]);
  }, [defaultRateValue]);

  const removeRow = useCallback((localId: string): void => {
    setRows((prev) =>
      prev.length <= 1 ? prev : prev.filter((row) => row.localId !== localId),
    );
  }, []);

  const updateRow = useCallback(
    (
      localId: string,
      patch: Partial<Omit<ManagedPopulationJobRowState, "localId">>,
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

  return { rows, addRow, removeRow, updateRow, duplicateJobIds };
}
