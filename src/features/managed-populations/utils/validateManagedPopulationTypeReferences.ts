import {
  checkJobLinkExpectedType,
  checkResourceIdsInWorld,
  type ReferenceIssue,
} from "@/lib/validateReferenceHelpers";

type MinimalEntity = { readonly id: string };

type MinimalJob = { readonly id: string; readonly jobType: string };

type ResourceRef = { readonly resourceId: string };

type ManagedPopulationTypeReferencePayload = {
  readonly cullingJobId?: string | null;
  readonly cullingOutputsJson?: readonly ResourceRef[];
  readonly husbandryJobId?: string | null;
  readonly maintenanceRulesJson?: readonly ResourceRef[];
};

export type ManagedPopulationTypeReferenceIssue = ReferenceIssue;

// Pre-flight reference check for managed population type create/update payloads.
// Returns UI-friendly issues when referenced entities are absent from the
// provided world-scoped lists. Cross-table consistency is also enforced at
// the DB layer; this helper surfaces errors before the round-trip.
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

  if (payload.husbandryJobId !== null && payload.husbandryJobId !== undefined) {
    checkJobLinkExpectedType(
      "husbandryJobId",
      payload.husbandryJobId,
      activeJobs,
      "husbandry",
      issues,
    );
  }

  if (payload.cullingJobId !== null && payload.cullingJobId !== undefined) {
    checkJobLinkExpectedType(
      "cullingJobId",
      payload.cullingJobId,
      activeJobs,
      "culling",
      issues,
    );
  }

  return issues;
}
