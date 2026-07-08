// Pure, unit-testable helpers backing the Recruit dialog's per-citizen
// eligibility checklist and cost-shortfall preview. The RPC (recruit_soldiers)
// is the real gate and only reports the first failing reason per citizen, so
// the client independently re-derives every reason a citizen would be
// rejected for, to show them all up front.
import type { TierCostEntry } from "@/features/buildings";

export type RecruitIneligibilityReason =
  | "already_soldier"
  | "enrolled_in_school"
  | "lacks_education"
  | "not_alive"
  | "not_resident"
  | "officeholder";

export type RecruitCandidateCitizen = {
  readonly educationLevelId: string | null;
  readonly id: string;
  readonly settlementId: string | null;
  readonly status: string;
};

export function classifyRecruitCandidate({
  citizen,
  enrolledCitizenIds,
  levelRankById,
  officeholderCitizenIds,
  requiredEducationLevelId,
  soldierCitizenIds,
  targetSettlementId,
}: {
  readonly citizen: RecruitCandidateCitizen;
  readonly enrolledCitizenIds: ReadonlySet<string>;
  readonly levelRankById: ReadonlyMap<string, number>;
  readonly officeholderCitizenIds: ReadonlySet<string>;
  readonly requiredEducationLevelId: string | null;
  readonly soldierCitizenIds: ReadonlySet<string>;
  readonly targetSettlementId: string;
}): readonly RecruitIneligibilityReason[] {
  const reasons: RecruitIneligibilityReason[] = [];

  if (citizen.status !== "alive") {
    reasons.push("not_alive");
  }
  if (citizen.settlementId !== targetSettlementId) {
    reasons.push("not_resident");
  }
  if (soldierCitizenIds.has(citizen.id)) {
    reasons.push("already_soldier");
  }
  if (enrolledCitizenIds.has(citizen.id)) {
    reasons.push("enrolled_in_school");
  }
  if (officeholderCitizenIds.has(citizen.id)) {
    reasons.push("officeholder");
  }
  if (requiredEducationLevelId !== null) {
    const requiredRank = levelRankById.get(requiredEducationLevelId) ?? 0;
    const citizenRank =
      citizen.educationLevelId !== null
        ? (levelRankById.get(citizen.educationLevelId) ?? 0)
        : 0;
    if (citizenRank < requiredRank) {
      reasons.push("lacks_education");
    }
  }

  return reasons;
}

export function formatRecruitIneligibilityReason(
  reason: RecruitIneligibilityReason,
  requiredEducationLevelName?: string,
): string {
  switch (reason) {
    case "not_alive":
      return "Not alive";
    case "not_resident":
      return "Not a resident of this settlement";
    case "already_soldier":
      return "Already a soldier";
    case "enrolled_in_school":
      return "Enrolled in school";
    case "officeholder":
      return "Holds a nation office";
    case "lacks_education":
      return requiredEducationLevelName !== undefined
        ? `Lacks required education (${requiredEducationLevelName})`
        : "Lacks required education";
  }
}

export type RecruitCostShortfall = {
  readonly available: number;
  readonly required: number;
  readonly resourceId: string;
  readonly shortfall: number;
};

// Best-effort client-side preview of recruitment_costs_json x selected-count
// against the funding source's available stockpile. The RPC is the source of
// truth on submit; this only warns.
export function computeRecruitCostShortfalls({
  availableByResourceId,
  costs,
  selectedCount,
}: {
  readonly availableByResourceId: ReadonlyMap<string, number>;
  readonly costs: readonly TierCostEntry[];
  readonly selectedCount: number;
}): readonly RecruitCostShortfall[] {
  if (selectedCount <= 0) {
    return [];
  }

  const shortfalls: RecruitCostShortfall[] = [];
  for (const cost of costs) {
    const required = cost.amount * selectedCount;
    const available = availableByResourceId.get(cost.resourceId) ?? 0;
    if (available < required) {
      shortfalls.push({
        available,
        required,
        resourceId: cost.resourceId,
        shortfall: required - available,
      });
    }
  }
  return shortfalls;
}
