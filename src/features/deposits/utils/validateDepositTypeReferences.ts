import {
  checkJobLinkExpectedType,
  checkResourceIdsInWorld,
  type ReferenceIssue,
} from "@/lib/validateReferenceHelpers";

type MinimalEntity = { readonly id: string };

type MinimalJob = { readonly id: string; readonly jobType: string };

type WorkerInputRef = { readonly resourceId: string };

type DepositTypeJobReferencePayload = {
  readonly jobId?: string | null;
  readonly workerInputsJson?: readonly WorkerInputRef[];
};

type DepositTypeReferencePayload = {
  readonly jobs?: readonly DepositTypeJobReferencePayload[];
};

export type DepositTypeReferenceIssue = ReferenceIssue;

// Pre-flight reference check for deposit type create/update payloads. A
// deposit type now links 1..n jobs (#1246), each with its own worker inputs,
// so every entry in `jobs` is checked independently. Returns UI-friendly
// issues when referenced entities are absent from the provided world-scoped
// lists. Cross-table consistency is also enforced at the DB layer; this
// helper surfaces errors before the round-trip.
export function validateDepositTypeReferencesAgainstWorld(
  payload: DepositTypeReferencePayload,
  activeResources: readonly MinimalEntity[],
  activeJobs: readonly MinimalJob[] = [],
): readonly DepositTypeReferenceIssue[] {
  const issues: DepositTypeReferenceIssue[] = [];
  const activeResourceIds = new Set(activeResources.map((r) => r.id));

  for (const job of payload.jobs ?? []) {
    checkResourceIdsInWorld(
      "workerInputsJson",
      job.workerInputsJson ?? [],
      activeResourceIds,
      issues,
    );

    if (job.jobId !== null && job.jobId !== undefined) {
      checkJobLinkExpectedType(
        "jobId",
        job.jobId,
        activeJobs,
        "deposit",
        issues,
      );
    }
  }

  return issues;
}
