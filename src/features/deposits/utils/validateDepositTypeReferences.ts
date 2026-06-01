import {
  checkJobLinkExpectedType,
  checkResourceIdsInWorld,
  type ReferenceIssue,
} from "@/lib/validateReferenceHelpers";

type MinimalEntity = { readonly id: string };

type MinimalJob = { readonly id: string; readonly jobType: string };

type WorkerInputRef = { readonly resourceId: string };

type DepositTypeReferencePayload = {
  readonly jobId?: string | null;
  readonly workerInputsJson?: readonly WorkerInputRef[];
};

export type DepositTypeReferenceIssue = ReferenceIssue;

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

  checkResourceIdsInWorld(
    "workerInputsJson",
    payload.workerInputsJson ?? [],
    activeResourceIds,
    issues,
  );

  if (payload.jobId !== null && payload.jobId !== undefined) {
    checkJobLinkExpectedType(
      "jobId",
      payload.jobId,
      activeJobs,
      "deposit",
      issues,
    );
  }

  return issues;
}
