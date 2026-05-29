type MinimalEntity = { readonly id: string };

type JobIoRef = { readonly resourceId: string };

type JobReferencePayload = {
  readonly inputsJson?: readonly JobIoRef[];
  readonly linkedDepositTypeId?: string | null;
  readonly linkedManagedPopulationTypeId?: string | null;
  readonly outputsJson?: readonly JobIoRef[];
};

export type JobReferenceIssue = {
  readonly field: string;
  readonly message: string;
};

// Pre-flight reference check for job create/update payloads.
// Returns UI-friendly issues when referenced entities are absent from the
// provided world-scoped lists. Cross-table consistency is also enforced at
// the DB layer; this helper surfaces errors before the round-trip.
export function validateJobReferencesAgainstWorld(
  payload: JobReferencePayload,
  activeResources: readonly MinimalEntity[],
  linkedTypes: readonly MinimalEntity[] = [],
): readonly JobReferenceIssue[] {
  const issues: JobReferenceIssue[] = [];
  const activeResourceIds = new Set(activeResources.map((r) => r.id));
  const linkedTypeIds = new Set(linkedTypes.map((t) => t.id));

  for (const entry of payload.inputsJson ?? []) {
    if (!activeResourceIds.has(entry.resourceId)) {
      issues.push({
        field: "inputsJson",
        message: `Resource ${entry.resourceId} is not an active resource in this world.`,
      });
    }
  }

  for (const entry of payload.outputsJson ?? []) {
    if (!activeResourceIds.has(entry.resourceId)) {
      issues.push({
        field: "outputsJson",
        message: `Resource ${entry.resourceId} is not an active resource in this world.`,
      });
    }
  }

  if (
    payload.linkedDepositTypeId !== null &&
    payload.linkedDepositTypeId !== undefined &&
    !linkedTypeIds.has(payload.linkedDepositTypeId)
  ) {
    issues.push({
      field: "linkedDepositTypeId",
      message: `Deposit type ${payload.linkedDepositTypeId} is not valid for this world.`,
    });
  }

  if (
    payload.linkedManagedPopulationTypeId !== null &&
    payload.linkedManagedPopulationTypeId !== undefined &&
    !linkedTypeIds.has(payload.linkedManagedPopulationTypeId)
  ) {
    issues.push({
      field: "linkedManagedPopulationTypeId",
      message: `Managed population type ${payload.linkedManagedPopulationTypeId} is not valid for this world.`,
    });
  }

  return issues;
}
