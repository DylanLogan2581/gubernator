import { describe, expect, it } from "vitest";

import {
  parseBuildingAutoDeconstructedPayload,
  parseBuildingRecoveredPayload,
  parseCitizenBornPayload,
  parseCitizenConsumedFoodWaterPayload,
  parseCitizenDiedHomelessPayload,
  parseCitizenStarvedPayload,
  parseConstructionProgressPayload,
  parseDepositProcessedPayload,
  parseEventBuildingDestroyedPayload,
  parseEventConsumptionMultiplierPayload,
  parseEventDepositDestroyedPayload,
  parseEventDepositDiscoveredPayload,
  parseEventManagedPopulationChangePayload,
  parseEventPopulationBoostPayload,
  parseEventPopulationLossPayload,
  parseEventProductionMultiplierPayload,
  parseEventResourceDrainPayload,
  parseEventResourceGrantPayload,
  parseEventUpkeepMultiplierPayload,
  parseManualDeconstructOvershootPayload,
  parsePassiveEffectAppliedPayload,
  parseStockpileClampedPayload,
  parseStockpileChangedPayload,
  parseBuildingSuspendedPayload,
  parseConstructionCompletedPayload,
  parseConstructionPausedPayload,
  parseDepositDepletedPayload,
  parseManagedPopulationDecliningPayload,
  parseManagedPopulationExtinctPayload,
  parsePartnershipFormedPayload,
  parsePartnershipWidowedPayload,
  parseSettlementHomelessnessOccurredPayload,
  parseSettlementStarvationOccurredPayload,
  parseTradeRoutePausedPayload,
  parseTradeRouteResumedPayload,
} from "./notificationPayloads.ts";

// Shared failure-mode helpers — the issue requires these are exercised.
function expectNullForCommonMalformed(
  parse: (input: unknown) => unknown,
): void {
  expect(parse(null)).toBeNull();
  expect(parse(undefined)).toBeNull();
  expect(parse("string")).toBeNull();
  expect(parse(42)).toBeNull();
  expect(parse([])).toBeNull();
}

// For each field in the valid payload, verify the parser rejects a copy where
// that field is missing and a copy where it has the wrong type.
function expectNullPerInvalidField(
  parse: (input: unknown) => unknown,
  valid: Record<string, unknown>,
): void {
  for (const key of Object.keys(valid)) {
    const { [key]: _omitted, ...missing } = valid;
    expect(parse(missing)).toBeNull();
    expect(parse({ ...valid, [key]: true })).toBeNull();
  }
}

describe("parseBuildingAutoDeconstructedPayload", () => {
  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseBuildingAutoDeconstructedPayload);
    expect(
      parseBuildingAutoDeconstructedPayload({
        buildingId: "b-1",
        gracePeriodTurns: 3,
        missedUpkeepCount: 4,
        // missing blueprintId
      }),
    ).toBeNull();
    expect(
      parseBuildingAutoDeconstructedPayload({
        blueprintId: "bp-1",
        buildingId: "b-1",
        gracePeriodTurns: "not-a-number",
        missedUpkeepCount: 4,
      }),
    ).toBeNull();
  });

  it("returns typed payload for valid input", () => {
    expect(
      parseBuildingAutoDeconstructedPayload({
        blueprintId: "bp-1",
        buildingId: "b-1",
        gracePeriodTurns: 3,
        missedUpkeepCount: 4,
      }),
    ).toEqual({
      blueprintId: "bp-1",
      buildingId: "b-1",
      gracePeriodTurns: 3,
      missedUpkeepCount: 4,
    });
  });
});

describe("parseBuildingSuspendedPayload", () => {
  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseBuildingSuspendedPayload);
    expect(
      parseBuildingSuspendedPayload({
        buildingId: "b-1",
        missedUpkeepCount: 2,
        // missing blueprintId
      }),
    ).toBeNull();
    expect(
      parseBuildingSuspendedPayload({
        blueprintId: "bp-1",
        buildingId: "b-1",
        missedUpkeepCount: "two",
      }),
    ).toBeNull();
  });

  it("returns typed payload for valid input", () => {
    expect(
      parseBuildingSuspendedPayload({
        blueprintId: "bp-1",
        buildingId: "b-1",
        missedUpkeepCount: 2,
      }),
    ).toEqual({ blueprintId: "bp-1", buildingId: "b-1", missedUpkeepCount: 2 });
  });
});

describe("parseConstructionCompletedPayload", () => {
  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseConstructionCompletedPayload);
    expect(
      parseConstructionCompletedPayload({ workers: 5 }), // missing projectId
    ).toBeNull();
    expect(
      parseConstructionCompletedPayload({
        projectId: "p-1",
        workers: "five",
      }),
    ).toBeNull();
  });

  it("returns typed payload for valid input", () => {
    expect(
      parseConstructionCompletedPayload({
        costsDeducted: {},
        newProgress: 100,
        projectId: "p-1",
        workers: 5,
        workerTurnsRequired: 100,
      }),
    ).toEqual({ projectId: "p-1", workers: 5 });
  });
});

describe("parseConstructionPausedPayload", () => {
  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseConstructionPausedPayload);
    expect(
      parseConstructionPausedPayload({ projectId: 123, workers: 3 }),
    ).toBeNull();
  });

  it("returns typed payload for valid input", () => {
    expect(
      parseConstructionPausedPayload({ projectId: "p-2", workers: 3 }),
    ).toEqual({ projectId: "p-2", workers: 3 });
  });
});

describe("parseDepositDepletedPayload", () => {
  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseDepositDepletedPayload);
    expect(
      parseDepositDepletedPayload({ depositId: "d-1" }), // missing depositName
    ).toBeNull();
    expect(
      parseDepositDepletedPayload({ depositId: 99, depositName: "Coal Seam" }),
    ).toBeNull();
  });

  it("returns typed payload for valid input", () => {
    expect(
      parseDepositDepletedPayload({
        depositId: "d-1",
        depositName: "Coal Seam",
      }),
    ).toEqual({ depositId: "d-1", depositName: "Coal Seam" });
  });
});

describe("parseManagedPopulationDecliningPayload", () => {
  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseManagedPopulationDecliningPayload);
    expect(
      parseManagedPopulationDecliningPayload({
        husbandryCoverage: 0.5,
        maintenanceCoverage: 0.8,
        managedPopulationInstanceId: "mp-1",
        // missing name
      }),
    ).toBeNull();
    expect(
      parseManagedPopulationDecliningPayload({
        husbandryCoverage: "low",
        maintenanceCoverage: 0.8,
        managedPopulationInstanceId: "mp-1",
        name: "Cattle",
      }),
    ).toBeNull();
  });

  it("returns typed payload for valid input", () => {
    expect(
      parseManagedPopulationDecliningPayload({
        husbandryCoverage: 0.5,
        maintenanceCoverage: 0.8,
        managedPopulationInstanceId: "mp-1",
        name: "Cattle",
      }),
    ).toEqual({
      husbandryCoverage: 0.5,
      maintenanceCoverage: 0.8,
      managedPopulationInstanceId: "mp-1",
      name: "Cattle",
    });
  });
});

describe("parseManagedPopulationExtinctPayload", () => {
  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseManagedPopulationExtinctPayload);
    expect(
      parseManagedPopulationExtinctPayload({
        managedPopulationInstanceId: "mp-1",
        // missing name
      }),
    ).toBeNull();
    expect(
      parseManagedPopulationExtinctPayload({
        managedPopulationInstanceId: 42,
        name: "Cattle",
      }),
    ).toBeNull();
  });

  it("returns typed payload for valid input", () => {
    expect(
      parseManagedPopulationExtinctPayload({
        managedPopulationInstanceId: "mp-1",
        name: "Cattle",
      }),
    ).toEqual({ managedPopulationInstanceId: "mp-1", name: "Cattle" });
  });
});

describe("parsePartnershipFormedPayload", () => {
  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parsePartnershipFormedPayload);
    expect(
      parsePartnershipFormedPayload({ citizenAId: "c-1" }), // missing citizenBId
    ).toBeNull();
    expect(
      parsePartnershipFormedPayload({ citizenAId: "c-1", citizenBId: 42 }),
    ).toBeNull();
  });

  it("returns typed payload for valid input", () => {
    expect(
      parsePartnershipFormedPayload({
        citizenAId: "c-1",
        citizenBId: "c-2",
      }),
    ).toEqual({ citizenAId: "c-1", citizenBId: "c-2" });
  });
});

describe("parsePartnershipWidowedPayload", () => {
  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parsePartnershipWidowedPayload);
    expect(
      parsePartnershipWidowedPayload({ partnershipId: "p-1" }), // missing survivingCitizenId
    ).toBeNull();
    expect(
      parsePartnershipWidowedPayload({
        partnershipId: null,
        survivingCitizenId: "c-2",
      }),
    ).toBeNull();
  });

  it("returns typed payload for valid input", () => {
    expect(
      parsePartnershipWidowedPayload({
        partnershipId: "p-1",
        survivingCitizenId: "c-2",
      }),
    ).toEqual({ partnershipId: "p-1", survivingCitizenId: "c-2" });
  });
});

describe("parseSettlementStarvationOccurredPayload", () => {
  it("returns null for non-object inputs", () => {
    expect(parseSettlementStarvationOccurredPayload(null)).toBeNull();
    expect(parseSettlementStarvationOccurredPayload("string")).toBeNull();
    expect(parseSettlementStarvationOccurredPayload(0)).toBeNull();
  });

  it("returns empty object for any object input", () => {
    expect(parseSettlementStarvationOccurredPayload({})).toEqual({});
    expect(
      parseSettlementStarvationOccurredPayload({ extra: "field" }),
    ).toEqual({});
  });
});

describe("parseSettlementHomelessnessOccurredPayload", () => {
  it("returns null for non-object inputs", () => {
    expect(parseSettlementHomelessnessOccurredPayload(null)).toBeNull();
    expect(parseSettlementHomelessnessOccurredPayload("string")).toBeNull();
    expect(parseSettlementHomelessnessOccurredPayload(42)).toBeNull();
  });

  it("returns empty object for any object input", () => {
    expect(parseSettlementHomelessnessOccurredPayload({})).toEqual({});
  });
});

describe("parseTradeRoutePausedPayload", () => {
  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseTradeRoutePausedPayload);
    expect(
      parseTradeRoutePausedPayload({
        destinationSettlementId: "s-2",
        pauseReason: "insufficient_origin_stock",
        quantityPerTransition: 10,
        resourceId: "r-1",
        // missing tradeRouteId
      }),
    ).toBeNull();
    expect(
      parseTradeRoutePausedPayload({
        destinationSettlementId: "s-2",
        pauseReason: "insufficient_origin_stock",
        quantityPerTransition: "ten",
        resourceId: "r-1",
        tradeRouteId: "tr-1",
      }),
    ).toBeNull();
  });

  it("returns typed payload for valid input", () => {
    expect(
      parseTradeRoutePausedPayload({
        destinationSettlementId: "s-2",
        pauseReason: "insufficient_origin_stock",
        quantityPerTransition: 10,
        resourceId: "r-1",
        tradeRouteId: "tr-1",
      }),
    ).toEqual({
      destinationSettlementId: "s-2",
      pauseReason: "insufficient_origin_stock",
      quantityPerTransition: 10,
      resourceId: "r-1",
      tradeRouteId: "tr-1",
    });
  });

  it("tolerates historical logs missing quantityPerTransition/resourceId (#1324)", () => {
    expect(
      parseTradeRoutePausedPayload({
        destinationSettlementId: "s-2",
        pauseReason: "insufficient_origin_stock",
        tradeRouteId: "tr-1",
      }),
    ).toEqual({
      destinationSettlementId: "s-2",
      pauseReason: "insufficient_origin_stock",
      quantityPerTransition: null,
      resourceId: null,
      tradeRouteId: "tr-1",
    });
  });
});

describe("parseTradeRouteResumedPayload", () => {
  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseTradeRouteResumedPayload);
    expect(
      parseTradeRouteResumedPayload({
        destinationSettlementId: "s-2",
        quantityTransferred: 10,
        resourceId: "r-1",
        // missing tradeRouteId
      }),
    ).toBeNull();
    expect(
      parseTradeRouteResumedPayload({
        destinationSettlementId: "s-2",
        quantityTransferred: 10,
        resourceId: 99,
        tradeRouteId: "tr-1",
      }),
    ).toBeNull();
  });

  it("returns typed payload for valid input", () => {
    expect(
      parseTradeRouteResumedPayload({
        destinationSettlementId: "s-2",
        quantityTransferred: 10,
        resourceId: "r-1",
        tradeRouteId: "tr-1",
      }),
    ).toEqual({
      destinationSettlementId: "s-2",
      quantityTransferred: 10,
      resourceId: "r-1",
      tradeRouteId: "tr-1",
    });
  });
});

describe("parseBuildingRecoveredPayload", () => {
  const valid = { blueprintId: "bp-1", buildingId: "b-1" };

  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseBuildingRecoveredPayload);
    expectNullPerInvalidField(parseBuildingRecoveredPayload, valid);
  });

  it("returns typed payload for valid input", () => {
    expect(parseBuildingRecoveredPayload(valid)).toEqual(valid);
  });
});

describe("parseCitizenBornPayload", () => {
  const valid = { parentACitizenId: "c-1", parentBCitizenId: "c-2" };

  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseCitizenBornPayload);
    expectNullPerInvalidField(parseCitizenBornPayload, valid);
  });

  it("returns typed payload for valid input", () => {
    expect(parseCitizenBornPayload(valid)).toEqual(valid);
  });
});

describe("parseCitizenConsumedFoodWaterPayload", () => {
  const valid = {
    aliveCount: 10,
    foodConsumed: 20,
    foodRequired: 20,
    foodStock: 100,
    settlementId: "s-1",
    waterConsumed: 10,
    waterRequired: 10,
    waterStock: 50,
  };

  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseCitizenConsumedFoodWaterPayload);
    expectNullPerInvalidField(parseCitizenConsumedFoodWaterPayload, valid);
  });

  it("returns typed payload for valid input", () => {
    expect(parseCitizenConsumedFoodWaterPayload(valid)).toEqual(valid);
  });
});

describe("parseCitizenDiedHomelessPayload", () => {
  const valid = { deathDetail: "exposure" };

  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseCitizenDiedHomelessPayload);
    expectNullPerInvalidField(parseCitizenDiedHomelessPayload, valid);
  });

  it("returns typed payload for valid input", () => {
    expect(parseCitizenDiedHomelessPayload(valid)).toEqual(valid);
  });
});

describe("parseCitizenStarvedPayload", () => {
  const valid = { deathDetail: "no food" };

  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseCitizenStarvedPayload);
    expectNullPerInvalidField(parseCitizenStarvedPayload, valid);
  });

  it("returns typed payload for valid input", () => {
    expect(parseCitizenStarvedPayload(valid)).toEqual(valid);
  });
});

describe("parseConstructionProgressPayload", () => {
  const valid = {
    costsDeducted: { "r-1": 5 },
    newProgress: 40,
    projectId: "p-1",
    settlementId: "s-1",
    workers: 4,
    workerTurnsRequired: 100,
  };

  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseConstructionProgressPayload);
    expectNullPerInvalidField(parseConstructionProgressPayload, valid);
    expect(
      parseConstructionProgressPayload({ ...valid, costsDeducted: null }),
    ).toBeNull();
  });

  it("returns typed payload for valid input", () => {
    expect(parseConstructionProgressPayload(valid)).toEqual(valid);
  });
});

describe("parseDepositProcessedPayload", () => {
  const valid = {
    depositId: "d-1",
    extractedByResource: { "r-1": 8 },
    inputShortfallScale: 1,
    inputsConsumed: { "r-2": 2 },
    settlementId: "s-1",
    totalExtraction: 8,
    workers: 3,
  };

  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseDepositProcessedPayload);
    expectNullPerInvalidField(parseDepositProcessedPayload, valid);
    expect(
      parseDepositProcessedPayload({ ...valid, extractedByResource: null }),
    ).toBeNull();
    expect(
      parseDepositProcessedPayload({ ...valid, inputsConsumed: null }),
    ).toBeNull();
  });

  it("returns typed payload for valid input", () => {
    expect(parseDepositProcessedPayload(valid)).toEqual(valid);
  });
});

describe("parseEventBuildingDestroyedPayload", () => {
  const valid = { eventId: "e-1", settlementBuildingId: "sb-1" };

  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseEventBuildingDestroyedPayload);
    expectNullPerInvalidField(parseEventBuildingDestroyedPayload, valid);
  });

  it("returns typed payload for valid input", () => {
    expect(parseEventBuildingDestroyedPayload(valid)).toEqual(valid);
  });
});

describe("parseEventConsumptionMultiplierPayload", () => {
  const valid = { eventId: "e-1", multiplier: 1.5, settlementId: "s-1" };

  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseEventConsumptionMultiplierPayload);
    expectNullPerInvalidField(parseEventConsumptionMultiplierPayload, valid);
  });

  it("returns typed payload for valid input", () => {
    expect(parseEventConsumptionMultiplierPayload(valid)).toEqual(valid);
  });
});

describe("parseEventDepositDiscoveredPayload", () => {
  const valid = { eventId: "e-1" };

  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseEventDepositDiscoveredPayload);
    expectNullPerInvalidField(parseEventDepositDiscoveredPayload, valid);
  });

  it("returns typed payload for valid input", () => {
    expect(parseEventDepositDiscoveredPayload(valid)).toEqual(valid);
  });
});

describe("parseEventDepositDestroyedPayload", () => {
  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseEventDepositDestroyedPayload);
    expect(parseEventDepositDestroyedPayload({})).toBeNull();
    // eventId present but neither type-target nor instance-target shape
    expect(parseEventDepositDestroyedPayload({ eventId: "e-1" })).toBeNull();
    expect(
      parseEventDepositDestroyedPayload({
        depositTypeId: "dt-1",
        destroyedCount: 2,
        // missing eventId
      }),
    ).toBeNull();
    expect(
      parseEventDepositDestroyedPayload({
        depositTypeId: "dt-1",
        destroyedCount: "two",
        eventId: "e-1",
      }),
    ).toBeNull();
  });

  it("returns type-target payload when depositTypeId and destroyedCount present", () => {
    expect(
      parseEventDepositDestroyedPayload({
        depositTypeId: "dt-1",
        destroyedCount: 2,
        eventId: "e-1",
      }),
    ).toEqual({ depositTypeId: "dt-1", destroyedCount: 2, eventId: "e-1" });
  });

  it("returns instance-target payload when depositInstanceId present", () => {
    expect(
      parseEventDepositDestroyedPayload({
        depositInstanceId: "di-1",
        eventId: "e-1",
      }),
    ).toEqual({ depositInstanceId: "di-1", eventId: "e-1" });
  });
});

describe("parseEventManagedPopulationChangePayload", () => {
  const valid = { delta: -3, eventId: "e-1", managedPopulationId: "mp-1" };

  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseEventManagedPopulationChangePayload);
    expectNullPerInvalidField(parseEventManagedPopulationChangePayload, valid);
  });

  it("returns typed payload for valid input", () => {
    expect(parseEventManagedPopulationChangePayload(valid)).toEqual(valid);
  });
});

describe("parseEventPopulationBoostPayload", () => {
  const valid = {
    amount: 5,
    citizenCount: 25,
    eventId: "e-1",
    settlementId: "s-1",
  };

  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseEventPopulationBoostPayload);
    expectNullPerInvalidField(parseEventPopulationBoostPayload, valid);
  });

  it("returns typed payload for valid input", () => {
    expect(parseEventPopulationBoostPayload(valid)).toEqual(valid);
  });
});

describe("parseEventPopulationLossPayload", () => {
  const valid = {
    amount: 4,
    citizenCount: 21,
    eventId: "e-1",
    settlementId: "s-1",
  };

  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseEventPopulationLossPayload);
    expectNullPerInvalidField(parseEventPopulationLossPayload, valid);
  });

  it("returns typed payload for valid input", () => {
    expect(parseEventPopulationLossPayload(valid)).toEqual(valid);
  });
});

describe("parseEventProductionMultiplierPayload", () => {
  const required = { eventId: "e-1", multiplier: 2, settlementId: "s-1" };

  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseEventProductionMultiplierPayload);
    expectNullPerInvalidField(parseEventProductionMultiplierPayload, required);
    expect(
      parseEventProductionMultiplierPayload({
        ...required,
        buildingBlueprintId: 42,
      }),
    ).toBeNull();
    expect(
      parseEventProductionMultiplierPayload({ ...required, jobId: 42 }),
    ).toBeNull();
  });

  it("returns typed payload with optional targets omitted", () => {
    expect(parseEventProductionMultiplierPayload(required)).toEqual({
      ...required,
      buildingBlueprintId: undefined,
      jobId: undefined,
    });
  });

  it("returns typed payload with optional targets present", () => {
    expect(
      parseEventProductionMultiplierPayload({
        ...required,
        buildingBlueprintId: "bp-1",
        jobId: "j-1",
      }),
    ).toEqual({ ...required, buildingBlueprintId: "bp-1", jobId: "j-1" });
  });
});

describe("parseEventResourceDrainPayload", () => {
  const valid = {
    amount: 12,
    eventId: "e-1",
    resourceId: "r-1",
    settlementId: "s-1",
  };

  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseEventResourceDrainPayload);
    expectNullPerInvalidField(parseEventResourceDrainPayload, valid);
  });

  it("returns typed payload for valid input", () => {
    expect(parseEventResourceDrainPayload(valid)).toEqual(valid);
  });
});

describe("parseEventResourceGrantPayload", () => {
  const valid = {
    amount: 12,
    eventId: "e-1",
    resourceId: "r-1",
    settlementId: "s-1",
  };

  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseEventResourceGrantPayload);
    expectNullPerInvalidField(parseEventResourceGrantPayload, valid);
  });

  it("returns typed payload for valid input", () => {
    expect(parseEventResourceGrantPayload(valid)).toEqual(valid);
  });
});

describe("parseEventUpkeepMultiplierPayload", () => {
  const valid = { eventId: "e-1", multiplier: 0.5, settlementId: "s-1" };

  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseEventUpkeepMultiplierPayload);
    expectNullPerInvalidField(parseEventUpkeepMultiplierPayload, valid);
  });

  it("returns typed payload for valid input", () => {
    expect(parseEventUpkeepMultiplierPayload(valid)).toEqual(valid);
  });
});

describe("parseManualDeconstructOvershootPayload", () => {
  const valid = {
    current_citizens: 12,
    new_cap: 10,
    settlement_building_id: "sb-1",
  };

  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseManualDeconstructOvershootPayload);
    expectNullPerInvalidField(parseManualDeconstructOvershootPayload, valid);
  });

  it("maps snake_case fields to camelCase payload", () => {
    expect(parseManualDeconstructOvershootPayload(valid)).toEqual({
      currentCitizens: 12,
      newCap: 10,
      settlementBuildingId: "sb-1",
    });
  });
});

describe("parsePassiveEffectAppliedPayload", () => {
  const valid = {
    amount: 3,
    buildingId: "b-1",
    resourceId: "r-1",
    settlementId: "s-1",
    tierId: "t-1",
  };

  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parsePassiveEffectAppliedPayload);
    expectNullPerInvalidField(parsePassiveEffectAppliedPayload, valid);
  });

  it("returns typed payload for valid input", () => {
    expect(parsePassiveEffectAppliedPayload(valid)).toEqual(valid);
  });
});

describe("parseStockpileClampedPayload", () => {
  const valid = {
    delta: -5,
    effectiveCap: 100,
    post: 100,
    pre: 105,
    reason: "over_cap",
    resourceId: "r-1",
    settlementId: "s-1",
  };

  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseStockpileClampedPayload);
    expectNullPerInvalidField(parseStockpileClampedPayload, valid);
    expect(
      parseStockpileClampedPayload({ ...valid, reason: "unknown" }),
    ).toBeNull();
  });

  it("returns typed payload for both clamp reasons", () => {
    expect(parseStockpileClampedPayload(valid)).toEqual(valid);
    expect(
      parseStockpileClampedPayload({ ...valid, reason: "negative" }),
    ).toEqual({ ...valid, reason: "negative" });
  });
});

describe("parseStockpileChangedPayload", () => {
  const valid = {
    changeAmount: -10,
    changeMode: "percent",
    delta: -2,
    post: 18,
    pre: 20,
    resourceId: "r-1",
    settlementId: "s-1",
  };

  it("returns null for malformed inputs", () => {
    expectNullForCommonMalformed(parseStockpileChangedPayload);
    expectNullPerInvalidField(parseStockpileChangedPayload, valid);
  });

  it("returns typed payload for valid input", () => {
    expect(parseStockpileChangedPayload(valid)).toEqual(valid);
  });
});
