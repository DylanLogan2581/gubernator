import { describe, expect, it } from "vitest";

import { buildCleanupDescription } from "./cleanupDescription";

describe("buildCleanupDescription", () => {
  it("returns undefined when no cleanup occurred", () => {
    const summary = {
      buildingTierConstructionCostsCleaned: 0,
      buildingTierEffectsCleaned: 0,
      buildingTierUpkeepCostsCleaned: 0,
      depositTypesWorkerInputsCleaned: 0,
      jobDefinitionsInputsCleaned: 0,
      jobDefinitionsOutputsCleaned: 0,
      managedPopulationCullingOutputsCleaned: 0,
      managedPopulationMaintenanceCleaned: 0,
    };

    expect(buildCleanupDescription(summary)).toBeUndefined();
  });

  it("formats single item cleanup correctly", () => {
    const summary = {
      buildingTierConstructionCostsCleaned: 0,
      buildingTierEffectsCleaned: 0,
      buildingTierUpkeepCostsCleaned: 0,
      depositTypesWorkerInputsCleaned: 0,
      jobDefinitionsInputsCleaned: 1,
      jobDefinitionsOutputsCleaned: 0,
      managedPopulationCullingOutputsCleaned: 0,
      managedPopulationMaintenanceCleaned: 0,
    };

    expect(buildCleanupDescription(summary)).toBe("Removed 1 job input.");
  });

  it("formats multiple items cleanup correctly", () => {
    const summary = {
      buildingTierConstructionCostsCleaned: 2,
      buildingTierEffectsCleaned: 0,
      buildingTierUpkeepCostsCleaned: 1,
      depositTypesWorkerInputsCleaned: 0,
      jobDefinitionsInputsCleaned: 3,
      jobDefinitionsOutputsCleaned: 0,
      managedPopulationCullingOutputsCleaned: 0,
      managedPopulationMaintenanceCleaned: 0,
    };

    expect(buildCleanupDescription(summary)).toBe(
      "Removed 3 job inputs, 2 tier construction costs, 1 tier upkeep cost.",
    );
  });

  it("uses correct singular/plural forms", () => {
    const summary = {
      buildingTierConstructionCostsCleaned: 1,
      buildingTierEffectsCleaned: 0,
      buildingTierUpkeepCostsCleaned: 0,
      depositTypesWorkerInputsCleaned: 2,
      jobDefinitionsInputsCleaned: 0,
      jobDefinitionsOutputsCleaned: 0,
      managedPopulationCullingOutputsCleaned: 0,
      managedPopulationMaintenanceCleaned: 0,
    };

    expect(buildCleanupDescription(summary)).toBe(
      "Removed 1 tier construction cost, 2 deposit worker inputs.",
    );
  });

  it("includes all types when multiple are cleaned", () => {
    const summary = {
      buildingTierConstructionCostsCleaned: 1,
      buildingTierEffectsCleaned: 1,
      buildingTierUpkeepCostsCleaned: 1,
      depositTypesWorkerInputsCleaned: 1,
      jobDefinitionsInputsCleaned: 1,
      jobDefinitionsOutputsCleaned: 1,
      managedPopulationCullingOutputsCleaned: 1,
      managedPopulationMaintenanceCleaned: 1,
    };

    expect(buildCleanupDescription(summary)).toBe(
      "Removed 1 job input, 1 job output, 1 tier construction cost, 1 tier upkeep cost, 1 tier effect, 1 deposit worker input, 1 population maintenance rule, 1 population culling output.",
    );
  });
});
