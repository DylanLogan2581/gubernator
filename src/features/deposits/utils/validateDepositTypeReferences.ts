type MinimalEntity = { readonly id: string };

type MinimalJob = { readonly id: string; readonly jobType: string };

type WorkerInputRef = { readonly resourceId: string };

type DepositTypeReferencePayload = {
  readonly jobId?: string | null;
  readonly workerInputsJson?: readonly WorkerInputRef[];
};

export type DepositTypeReferenceIssue = {
  readonly field: string;
  readonly message: string;
};

// Pre-flight reference check for deposit type create/update payloads.
// Returns UI-friendly issues when referenced entities are absent from the
// provided world-scoped lists. Cross-table consistency is also enforced at
// the DB layer; this helper surfaces errors before the round-trip.
export function validateDepositTypeReferencesAgainstWorld(
  payload: DepositTypeReferencePayload,
  activeResources: readonly MinimalEntity[],
  activeJobs: readonly MinimalJob[] = [],
): readonly DepositTypeReferenceIssue[] {
  const issues: DepositTypeReferenceIssue[] = [];
  const activeResourceIds = new Set(activeResources.map((r) => r.id));

  for (const entry of payload.workerInputsJson ?? []) {
    if (!activeResourceIds.has(entry.resourceId)) {
      issues.push({
        field: "workerInputsJson",
        message: `Resource ${entry.resourceId} is not an active resource in this world.`,
      });
    }
  }

  if (payload.jobId !== null && payload.jobId !== undefined) {
    const job = activeJobs.find((j) => j.id === payload.jobId);
    if (job === undefined) {
      issues.push({
        field: "jobId",
        message: `Job ${payload.jobId} is not an active job in this world.`,
      });
    } else if (job.jobType !== "deposit") {
      issues.push({
        field: "jobId",
        message: `Job ${payload.jobId} must have job type 'deposit'.`,
      });
    }
  }

  return issues;
}
