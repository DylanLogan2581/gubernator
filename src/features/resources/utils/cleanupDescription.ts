import type { ResourceCleanupSummary } from "../types/resourceTypes";

export function buildCleanupDescription(
  summary: ResourceCleanupSummary,
): string | undefined {
  type Entry = {
    readonly count: number;
    readonly singular: string;
    readonly plural: string;
  };
  const entries: Entry[] = [
    {
      count: summary.jobDefinitionsInputsCleaned,
      plural: "job inputs",
      singular: "job input",
    },
    {
      count: summary.jobDefinitionsOutputsCleaned,
      plural: "job outputs",
      singular: "job output",
    },
    {
      count: summary.buildingTierConstructionCostsCleaned,
      plural: "tier construction costs",
      singular: "tier construction cost",
    },
    {
      count: summary.buildingTierUpkeepCostsCleaned,
      plural: "tier upkeep costs",
      singular: "tier upkeep cost",
    },
    {
      count: summary.buildingTierEffectsCleaned,
      plural: "tier effects",
      singular: "tier effect",
    },
    {
      count: summary.depositTypesWorkerInputsCleaned,
      plural: "deposit worker inputs",
      singular: "deposit worker input",
    },
    {
      count: summary.managedPopulationMaintenanceCleaned,
      plural: "population maintenance rules",
      singular: "population maintenance rule",
    },
    {
      count: summary.managedPopulationCullingOutputsCleaned,
      plural: "population culling outputs",
      singular: "population culling output",
    },
  ];

  const parts = entries
    .filter((e) => e.count > 0)
    .map((e) => `${e.count} ${e.count === 1 ? e.singular : e.plural}`);

  if (parts.length === 0) return undefined;
  return `Removed ${parts.join(", ")}.`;
}
