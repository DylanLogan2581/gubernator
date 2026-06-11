import { describe, expect, it } from "vitest";

import {
  parseBuildingAutoDeconstructedPayload,
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
