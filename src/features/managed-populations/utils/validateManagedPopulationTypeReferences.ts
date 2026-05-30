type MinimalEntity = { readonly id: string };

type MinimalJob = { readonly id: string; readonly jobType: string };

type ResourceRef = { readonly resourceId: string };

type ManagedPopulationTypeReferencePayload = {
  readonly cullingJobId?: string | null;
  readonly cullingOutputsJson?: readonly ResourceRef[];
  readonly husbandryJobId?: string | null;
  readonly maintenanceRulesJson?: readonly ResourceRef[];
};

export type ManagedPopulationTypeReferenceIssue = {
  readonly field: string;
  readonly message: string;
};

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

  for (const entry of payload.maintenanceRulesJson ?? []) {
    if (!activeResourceIds.has(entry.resourceId)) {
      issues.push({
        field: "maintenanceRulesJson",
        message: `Resource ${entry.resourceId} is not an active resource in this world.`,
      });
    }
  }

  for (const entry of payload.cullingOutputsJson ?? []) {
    if (!activeResourceIds.has(entry.resourceId)) {
      issues.push({
        field: "cullingOutputsJson",
        message: `Resource ${entry.resourceId} is not an active resource in this world.`,
      });
    }
  }

  if (payload.husbandryJobId !== null && payload.husbandryJobId !== undefined) {
    const job = activeJobs.find((j) => j.id === payload.husbandryJobId);
    if (job === undefined) {
      issues.push({
        field: "husbandryJobId",
        message: `Job ${payload.husbandryJobId} is not an active job in this world.`,
      });
    } else if (job.jobType !== "husbandry") {
      issues.push({
        field: "husbandryJobId",
        message: `Job ${payload.husbandryJobId} must have job type 'husbandry'.`,
      });
    }
  }

  if (payload.cullingJobId !== null && payload.cullingJobId !== undefined) {
    const job = activeJobs.find((j) => j.id === payload.cullingJobId);
    if (job === undefined) {
      issues.push({
        field: "cullingJobId",
        message: `Job ${payload.cullingJobId} is not an active job in this world.`,
      });
    } else if (job.jobType !== "culling") {
      issues.push({
        field: "cullingJobId",
        message: `Job ${payload.cullingJobId} must have job type 'culling'.`,
      });
    }
  }

  return issues;
}
