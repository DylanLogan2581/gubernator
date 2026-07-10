import {
  checkResourceIdsInWorld,
  type ReferenceIssue,
} from "@/lib/validateReferenceHelpers";

type MinimalEntity = { readonly id: string };

type TierCostRef = { readonly resourceId: string };

type TierEffectRef =
  | {
      readonly amount: number;
      readonly jobId: string;
      readonly type: "job_capacity_increase";
    }
  | {
      readonly amount: number;
      readonly resourceId: string;
      readonly type: "passive_resource_production";
    }
  | {
      readonly amount: number;
      readonly resourceId: string;
      readonly type: "resource_storage_increase";
    }
  | {
      readonly amount: number;
      readonly type: "population_cap_increase";
    }
  | {
      readonly levels: readonly {
        readonly fromLevelId: string | null;
        readonly toLevelId: string;
      }[];
      readonly teacherJobId: string;
      readonly type: "education";
    };

type TierReferencePayload = {
  readonly constructionCostsJson?: readonly TierCostRef[];
  readonly effectsJson?: readonly TierEffectRef[];
  readonly upkeepCostsJson?: readonly TierCostRef[];
};

export type BuildingReferenceIssue = ReferenceIssue;

function checkEducationEffectRefs(
  effect: Extract<TierEffectRef, { readonly type: "education" }>,
  activeJobIds: ReadonlySet<string>,
  activeEducationLevelIds: ReadonlySet<string>,
  issues: BuildingReferenceIssue[],
): void {
  if (!activeJobIds.has(effect.teacherJobId)) {
    issues.push({
      field: "effectsJson",
      message: `Job ${effect.teacherJobId} is not an active job in this world.`,
    });
  }
  for (const level of effect.levels) {
    if (
      level.fromLevelId !== null &&
      !activeEducationLevelIds.has(level.fromLevelId)
    ) {
      issues.push({
        field: "effectsJson",
        message: `Education level ${level.fromLevelId} does not exist in this world.`,
      });
    }
    if (!activeEducationLevelIds.has(level.toLevelId)) {
      issues.push({
        field: "effectsJson",
        message: `Education level ${level.toLevelId} does not exist in this world.`,
      });
    }
  }
}

// Pre-flight reference check for tier create/update payloads.
// Returns UI-friendly issues when referenced entities are absent from the
// provided world-scoped lists. Cross-table consistency is also enforced at
// the DB layer; this helper surfaces errors before the round-trip.
export function validateBlueprintTierReferencesAgainstWorld(
  payload: TierReferencePayload,
  activeResources: readonly MinimalEntity[],
  activeJobs: readonly MinimalEntity[] = [],
  activeEducationLevels: readonly MinimalEntity[] = [],
): readonly BuildingReferenceIssue[] {
  const issues: BuildingReferenceIssue[] = [];
  const activeResourceIds = new Set(activeResources.map((r) => r.id));
  const activeJobIds = new Set(activeJobs.map((j) => j.id));
  const activeEducationLevelIds = new Set(
    activeEducationLevels.map((l) => l.id),
  );

  checkResourceIdsInWorld(
    "constructionCostsJson",
    payload.constructionCostsJson ?? [],
    activeResourceIds,
    issues,
  );
  checkResourceIdsInWorld(
    "upkeepCostsJson",
    payload.upkeepCostsJson ?? [],
    activeResourceIds,
    issues,
  );

  const resourceEffects = (payload.effectsJson ?? []).filter(
    (e): e is Extract<TierEffectRef, { readonly resourceId: string }> =>
      e.type === "passive_resource_production" ||
      e.type === "resource_storage_increase",
  );
  checkResourceIdsInWorld(
    "effectsJson",
    resourceEffects,
    activeResourceIds,
    issues,
  );

  for (const effect of payload.effectsJson ?? []) {
    if (
      effect.type === "job_capacity_increase" &&
      !activeJobIds.has(effect.jobId)
    ) {
      issues.push({
        field: "effectsJson",
        message: `Job ${effect.jobId} is not an active job in this world.`,
      });
    }
    if (effect.type === "education") {
      checkEducationEffectRefs(
        effect,
        activeJobIds,
        activeEducationLevelIds,
        issues,
      );
    }
  }

  return issues;
}
