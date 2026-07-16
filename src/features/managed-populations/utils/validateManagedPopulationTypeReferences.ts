import {
  checkJobLinkExpectedType,
  checkResourceIdsInWorld,
  type ReferenceIssue,
} from "@/lib/validateReferenceHelpers";

type MinimalEntity = { readonly id: string };

type MinimalJob = { readonly id: string; readonly jobType: string };

type ResourceRef = { readonly resourceId: string };

type ManagedPopulationJobReferencePayload = {
  readonly jobId?: string | null;
};

type ManagedPopulationTypeReferencePayload = {
  readonly cullingJobs?: readonly ManagedPopulationJobReferencePayload[];
  readonly cullingOutputsJson?: readonly ResourceRef[];
  readonly husbandryJobs?: readonly ManagedPopulationJobReferencePayload[];
  readonly maintenanceRulesJson?: readonly ResourceRef[];
};

export type ManagedPopulationTypeReferenceIssue = ReferenceIssue;

// Pre-flight reference check for managed population type create/update
// payloads. A population type now links 1..n husbandry jobs and 1..n
// culling jobs (#1247), so every entry in `husbandryJobs`/`cullingJobs` is
// checked independently. Returns UI-friendly issues when referenced
// entities are absent from the provided world-scoped lists. Cross-table
// consistency is also enforced at the DB layer; this helper surfaces
// errors before the round-trip.
export function validateManagedPopulationTypeReferencesAgainstWorld(
  payload: ManagedPopulationTypeReferencePayload,
  activeResources: readonly MinimalEntity[],
  activeJobs: readonly MinimalJob[] = [],
): readonly ManagedPopulationTypeReferenceIssue[] {
  const issues: ManagedPopulationTypeReferenceIssue[] = [];
  const activeResourceIds = new Set(activeResources.map((r) => r.id));

  checkResourceIdsInWorld(
    "maintenanceRulesJson",
    payload.maintenanceRulesJson ?? [],
    activeResourceIds,
    issues,
  );
  checkResourceIdsInWorld(
    "cullingOutputsJson",
    payload.cullingOutputsJson ?? [],
    activeResourceIds,
    issues,
  );

  for (const job of payload.husbandryJobs ?? []) {
    if (job.jobId !== null && job.jobId !== undefined) {
      checkJobLinkExpectedType(
        "husbandryJobs",
        job.jobId,
        activeJobs,
        "husbandry",
        issues,
      );
    }
  }

  for (const job of payload.cullingJobs ?? []) {
    if (job.jobId !== null && job.jobId !== undefined) {
      checkJobLinkExpectedType(
        "cullingJobs",
        job.jobId,
        activeJobs,
        "culling",
        issues,
      );
    }
  }

  return issues;
}
