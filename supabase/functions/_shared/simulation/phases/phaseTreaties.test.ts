// Unit tests for phaseTreaties / phaseTreatyMarriageNotes — tribute
// transfers, expiry, and royal-marriage death notes on active nation
// treaties each transition (issue #1090).
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import { describe, expect, it } from "vitest";

import { phaseTreaties, phaseTreatyMarriageNotes } from "./phaseTreaties.ts";
import { makeContext, makeTreaty } from "./testFixtures.ts";

import type { CitizenDeath } from "../simulationTypes.ts";

function deathOf(citizenId: string): CitizenDeath[] {
  return [{ category: "starvation", citizenId, detail: null }];
}

describe("phaseTreaties — tribute", () => {
  it("transfers the full quantity when the payer has enough stock", () => {
    const ctx = makeContext({
      nationTreaties: [
        makeTreaty({
          id: "t1",
          proposerNationId: "payer",
          responderNationId: "payee",
          treatyType: "tribute",
          tributePayer: "proposer",
          tributeQuantityPerTurn: 10,
          tributeResourceId: "gold",
        }),
      ],
      turnNumber: 5,
    });
    ctx.shared.pendingNationStockpiles.set("payer:gold", 100);

    const result = phaseTreaties(ctx);

    expect(result.nationStockpileDeltas).toEqual([
      { delta: -10, nationId: "payer", resourceId: "gold" },
      { delta: 10, nationId: "payee", resourceId: "gold" },
    ]);
    expect(result.treatyStatusChanges).toHaveLength(0);
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]).toMatchObject({
      category: "nation.tribute_transferred",
      nationId: "payer",
      payload: {
        payeeNationId: "payee",
        payerNationId: "payer",
        quantityTransferred: 10,
        resourceId: "gold",
        treatyId: "t1",
      },
    });
    expect(result.nationTurnSnapshots).toEqual([
      {
        nationId: "payee",
        taxCollectedByResource: {},
        tributePaidByResource: {},
        tributeReceivedByResource: { gold: 10 },
      },
      {
        nationId: "payer",
        taxCollectedByResource: {},
        tributePaidByResource: { gold: 10 },
        tributeReceivedByResource: {},
      },
    ]);
  });

  it("transfers what exists and logs nation.tribute_missed when stock is insufficient", () => {
    const ctx = makeContext({
      nationTreaties: [
        makeTreaty({
          id: "t1",
          proposerNationId: "payer",
          responderNationId: "payee",
          treatyType: "tribute",
          tributePayer: "proposer",
          tributeQuantityPerTurn: 10,
          tributeResourceId: "gold",
        }),
      ],
      turnNumber: 5,
    });
    ctx.shared.pendingNationStockpiles.set("payer:gold", 4);

    const result = phaseTreaties(ctx);

    expect(result.nationStockpileDeltas).toEqual([
      { delta: -4, nationId: "payer", resourceId: "gold" },
      { delta: 4, nationId: "payee", resourceId: "gold" },
    ]);
    expect(result.logs.map((l) => l.category)).toEqual([
      "nation.tribute_transferred",
      "nation.tribute_missed",
    ]);
    expect(result.logs[1]).toMatchObject({
      category: "nation.tribute_missed",
      nationId: "payer",
      payload: {
        payeeNationId: "payee",
        payerNationId: "payer",
        quantityMissing: 6,
        quantityRequested: 10,
        quantityTransferred: 4,
        resourceId: "gold",
        treatyId: "t1",
      },
    });
  });

  it("logs only nation.tribute_missed (no transfer) when the payer has nothing", () => {
    const ctx = makeContext({
      nationTreaties: [
        makeTreaty({
          id: "t1",
          proposerNationId: "payer",
          responderNationId: "payee",
          treatyType: "tribute",
          tributePayer: "responder",
          tributeQuantityPerTurn: 10,
          tributeResourceId: "gold",
        }),
      ],
      turnNumber: 5,
    });

    const result = phaseTreaties(ctx);

    expect(result.nationStockpileDeltas).toHaveLength(0);
    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]).toMatchObject({
      category: "nation.tribute_missed",
      nationId: "payee",
      payload: {
        payeeNationId: "payer",
        payerNationId: "payee",
        quantityMissing: 10,
        quantityTransferred: 0,
      },
    });
  });
});

describe("phaseTreaties — expiry", () => {
  it("flips a treaty whose ends_turn_number has been reached to expired", () => {
    const ctx = makeContext({
      nationTreaties: [
        makeTreaty({
          endsTurnNumber: 6,
          id: "t1",
          proposerNationId: "n1",
          responderNationId: "n2",
          treatyType: "trade_agreement",
        }),
      ],
      turnNumber: 5,
    });

    const result = phaseTreaties(ctx);

    expect(result.treatyStatusChanges).toEqual([{ toStatus: "expired", treatyId: "t1" }]);
    expect(result.logs).toEqual([
      {
        category: "nation.treaty_expired",
        nationId: "n1",
        payload: {
          proposerNationId: "n1",
          responderNationId: "n2",
          treatyId: "t1",
          treatyType: "trade_agreement",
        },
        phase: "treaties",
      },
    ]);
  });

  it("leaves a treaty untouched when ends_turn_number is still in the future", () => {
    const ctx = makeContext({
      nationTreaties: [
        makeTreaty({
          endsTurnNumber: 7,
          id: "t1",
          proposerNationId: "n1",
          responderNationId: "n2",
          treatyType: "trade_agreement",
        }),
      ],
      turnNumber: 5,
    });

    const result = phaseTreaties(ctx);

    expect(result.treatyStatusChanges).toHaveLength(0);
    expect(result.logs).toHaveLength(0);
  });

  it("never touches an open-ended treaty (ends_turn_number null)", () => {
    const ctx = makeContext({
      nationTreaties: [
        makeTreaty({
          endsTurnNumber: null,
          id: "t1",
          proposerNationId: "n1",
          responderNationId: "n2",
          treatyType: "trade_agreement",
        }),
      ],
      turnNumber: 999,
    });

    const result = phaseTreaties(ctx);

    expect(result.treatyStatusChanges).toHaveLength(0);
  });
});

describe("phaseTreatyMarriageNotes", () => {
  it("logs a death note when a linked citizen died this transition", () => {
    const ctx = makeContext({
      nationTreaties: [
        makeTreaty({
          id: "t1",
          marriageCitizenAId: "citizen-a",
          marriageCitizenBId: "citizen-b",
          proposerNationId: "n1",
          responderNationId: "n2",
          treatyType: "royal_marriage",
        }),
      ],
    });

    const result = phaseTreatyMarriageNotes(ctx, deathOf("citizen-b"));

    expect(result.logs).toEqual([
      {
        category: "nation.treaty_marriage_death_note",
        nationId: "n1",
        payload: {
          deceasedCitizenIds: ["citizen-b"],
          proposerNationId: "n1",
          responderNationId: "n2",
          treatyId: "t1",
        },
        phase: "treaties",
      },
    ]);
  });

  it("emits nothing when neither linked citizen died", () => {
    const ctx = makeContext({
      nationTreaties: [
        makeTreaty({
          id: "t1",
          marriageCitizenAId: "citizen-a",
          marriageCitizenBId: "citizen-b",
          proposerNationId: "n1",
          responderNationId: "n2",
          treatyType: "royal_marriage",
        }),
      ],
    });

    const result = phaseTreatyMarriageNotes(ctx, deathOf("someone-else"));

    expect(result.logs).toHaveLength(0);
  });

  it("keeps the treaty active — no treatyStatusChanges emitted by this phase", () => {
    const ctx = makeContext({
      nationTreaties: [
        makeTreaty({
          id: "t1",
          marriageCitizenAId: "citizen-a",
          marriageCitizenBId: "citizen-b",
          proposerNationId: "n1",
          responderNationId: "n2",
          treatyType: "royal_marriage",
        }),
      ],
    });

    const result = phaseTreatyMarriageNotes(ctx, deathOf("citizen-a"));

    expect(result).not.toHaveProperty("treatyStatusChanges");
  });
});
