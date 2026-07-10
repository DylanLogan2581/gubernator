import type { EducationLevel } from "@/features/education";
import type { JobDefinition } from "@/features/jobs";
import type { Resource } from "@/features/resources";
import type { TierEducationConfig } from "@/shared/education/tierEducationConfig";

import type { TierCostEntry, TierEffect } from "../types/buildingTypes";

function resolveResourceName(
  resourceId: string,
  resources: readonly Resource[],
): string {
  return resources.find((r) => r.id === resourceId)?.name ?? "[unknown]";
}

function resolveJobName(jobId: string, jobs: readonly JobDefinition[]): string {
  return jobs.find((j) => j.id === jobId)?.name ?? "[unknown]";
}

function resolveEducationLevelName(
  levelId: string,
  levels: readonly EducationLevel[],
): string {
  return levels.find((l) => l.id === levelId)?.name ?? "[unknown]";
}

export function formatTierCosts(
  costs: readonly TierCostEntry[],
  resources: readonly Resource[],
): string {
  return costs
    .map((c) => `${c.amount} ${resolveResourceName(c.resourceId, resources)}`)
    .join(", ");
}

export function formatTierEffects(
  effects: readonly TierEffect[],
  resources: readonly Resource[],
  jobs: readonly JobDefinition[],
  educationLevels: readonly EducationLevel[] = [],
): string {
  return effects
    .map((e) => {
      switch (e.type) {
        case "job_capacity_increase":
          return `+${e.amount} ${resolveJobName(e.jobId, jobs)} capacity`;
        case "passive_resource_production":
          return `+${e.amount} ${resolveResourceName(e.resourceId, resources)}/turn`;
        case "resource_storage_increase":
          return `+${e.amount} ${resolveResourceName(e.resourceId, resources)} storage`;
        case "population_cap_increase":
          return `+${e.amount} pop cap`;
        case "education":
          return `School: ${formatTierEducationConfig(e, educationLevels, jobs)}`;
      }
    })
    .join(", ");
}

export function formatTierEducationConfig(
  config: TierEducationConfig,
  levels: readonly EducationLevel[],
  jobs: readonly JobDefinition[],
): string {
  const transitions = config.levels
    .map((l) => {
      const fromName =
        l.fromLevelId === null
          ? "None"
          : resolveEducationLevelName(l.fromLevelId, levels);
      const toName = resolveEducationLevelName(l.toLevelId, levels);
      return `${fromName}→${toName} (${l.turns}t)`;
    })
    .join(", ");
  const teacherName = resolveJobName(config.teacherJobId, jobs);
  const capacity = config.teacherCapacity * config.studentsPerTeacher;
  return `${transitions}; ${teacherName} × ${config.teacherCapacity} (${capacity} students max)`;
}
