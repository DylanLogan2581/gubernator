import {
  checkResourceIdsInWorld,
  type ReferenceIssue,
} from "@/lib/validateReferenceHelpers";

type MinimalEntity = { readonly id: string };

type JobIoRef = { readonly resourceId: string };

type JobReferencePayload = {
  readonly inputsJson?: readonly JobIoRef[];
  readonly linkedDepositTypeId?: string | null;
  readonly linkedManagedPopulationTypeId?: string | null;
  readonly outputsJson?: readonly JobIoRef[];
};

export type JobReferenceIssue = ReferenceIssue;

// Pre-flight reference check for job create/update payloads.
// Returns UI-friendly issues when referenced entities are absent from the
// provided world-scoped lists. Cross-table consistency is also enforced at
// the DB layer; this helper surfaces errors before the round-trip.
export function validateJobReferencesAgainstWorld(
  payload: JobReferencePayload,
  activeResources: readonly MinimalEntity[],
  depositTypes: readonly MinimalEntity[] = [],
  managedPopulationTypes: readonly MinimalEntity[] = [],
): readonly JobReferenceIssue[] {
  const issues: JobReferenceIssue[] = [];
  const activeResourceIds = new Set(activeResources.map((r) => r.id));
  const depositTypeIds = new Set(depositTypes.map((t) => t.id));
  const managedPopulationTypeIds = new Set(
    managedPopulationTypes.map((t) => t.id),
  );

  checkResourceIdsInWorld(
    "inputsJson",
    payload.inputsJson ?? [],
    activeResourceIds,
    issues,
  );
  checkResourceIdsInWorld(
    "outputsJson",
    payload.outputsJson ?? [],
    activeResourceIds,
    issues,
  );

  if (
    payload.linkedDepositTypeId !== null &&
    payload.linkedDepositTypeId !== undefined &&
    !depositTypeIds.has(payload.linkedDepositTypeId)
  ) {
    issues.push({
      field: "linkedDepositTypeId",
      message: `Deposit type ${payload.linkedDepositTypeId} is not valid for this world.`,
    });
  }

  if (
    payload.linkedManagedPopulationTypeId !== null &&
    payload.linkedManagedPopulationTypeId !== undefined &&
    !managedPopulationTypeIds.has(payload.linkedManagedPopulationTypeId)
  ) {
    issues.push({
      field: "linkedManagedPopulationTypeId",
      message: `Managed population type ${payload.linkedManagedPopulationTypeId} is not valid for this world.`,
    });
  }

  return issues;
}
