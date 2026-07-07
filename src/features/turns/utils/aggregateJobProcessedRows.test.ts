import { describe, expect, it } from "vitest";

import {
  aggregateJobProcessedRows,
  summarizeJobBreakdown,
} from "./aggregateJobProcessedRows";

import type { TurnLogBrowserEntry } from "../queries/turnLogBrowserQueries";

function makeEntry(
  overrides: Partial<TurnLogBrowserEntry> & { readonly id: string },
): TurnLogBrowserEntry {
  return {
    citizenId: null,
    citizenName: null,
    fromTurnNumber: 9,
    logCategory: "standard_job.processed",
    nationId: null,
    nationName: null,
    payloadJsonb: null,
    resourceId: null,
    settlementId: "settlement-1",
    settlementName: "Northwatch",
    settlementNationId: null,
    toTurnNumber: 10,
    turnTransitionId: "transition-1",
    worldId: "world-1",
    ...overrides,
  };
}

describe("aggregateJobProcessedRows", () => {
  it("collapses standard_job.processed rows sharing a turn and settlement", () => {
    const entries = [
      makeEntry({ id: "1" }),
      makeEntry({ id: "2" }),
      makeEntry({ id: "3", logCategory: "citizen.born" }),
    ];

    const rows = aggregateJobProcessedRows(entries);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ kind: "job-summary", count: 2 });
    expect(rows[1]).toMatchObject({ kind: "entry" });
  });

  it("keeps separate summaries per settlement and per turn", () => {
    const entries = [
      makeEntry({ id: "1", settlementId: "settlement-1" }),
      makeEntry({ id: "2", settlementId: "settlement-2" }),
      makeEntry({ id: "3", settlementId: "settlement-1", toTurnNumber: 9 }),
    ];

    const rows = aggregateJobProcessedRows(entries);

    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.kind === "job-summary")).toBe(true);
  });

  it("preserves non-job rows unaggregated in order", () => {
    const entries = [
      makeEntry({ id: "1", logCategory: "citizen.born" }),
      makeEntry({ id: "2" }),
      makeEntry({ id: "3", logCategory: "citizen.starved" }),
    ];

    const rows = aggregateJobProcessedRows(entries);

    expect(rows.map((row) => row.kind)).toEqual([
      "entry",
      "job-summary",
      "entry",
    ]);
  });
});

describe("summarizeJobBreakdown", () => {
  it("sums worker counts and resource deltas per job across entries", () => {
    const entries = [
      makeEntry({
        id: "1",
        payloadJsonb: {
          inputsConsumed: { wood: 4 },
          jobId: "job-woodcutter",
          outputsProduced: { planks: 2 },
          scale: 1,
          settlementId: "settlement-1",
          workerCount: 2,
        },
      }),
      makeEntry({
        id: "2",
        payloadJsonb: {
          inputsConsumed: { wood: 6 },
          jobId: "job-woodcutter",
          outputsProduced: { planks: 3 },
          scale: 1,
          settlementId: "settlement-1",
          workerCount: 3,
        },
      }),
      makeEntry({
        id: "3",
        payloadJsonb: {
          inputsConsumed: {},
          jobId: "job-farmer",
          outputsProduced: { grain: 5 },
          scale: 1,
          settlementId: "settlement-1",
          workerCount: 1,
        },
      }),
    ];

    const breakdown = summarizeJobBreakdown(entries);

    expect(breakdown).toHaveLength(2);
    const woodcutter = breakdown.find((row) => row.jobId === "job-woodcutter");
    expect(woodcutter).toMatchObject({
      inputsConsumed: { wood: 10 },
      outputsProduced: { planks: 5 },
      workerCount: 5,
    });
    const farmer = breakdown.find((row) => row.jobId === "job-farmer");
    expect(farmer).toMatchObject({
      outputsProduced: { grain: 5 },
      workerCount: 1,
    });
  });

  it("ignores entries with malformed payloads", () => {
    const entries = [makeEntry({ id: "1", payloadJsonb: { bogus: true } })];

    expect(summarizeJobBreakdown(entries)).toEqual([]);
  });
});
