// Unit tests for phaseSuccession — detects nations whose manager citizen
// ("ruler") died this transition and computes succession candidates per the
// nation's government rules (issue #1078).
//
// Cross-runtime module: Deno-compatible, no browser APIs.

import { describe, expect, it } from "vitest";

import { phaseSuccession } from "./phaseSuccession.ts";
import { makeCitizen, makeContext, makeNation, makeSettlement } from "./testFixtures.ts";

import type { CitizenDeath } from "../simulationTypes.ts";

function deathOf(citizenId: string): CitizenDeath[] {
  return [{ category: "starvation", citizenId, detail: null }];
}

describe("phaseSuccession — monarchy (hereditary)", () => {
  it("produces exactly one log entry and one notification naming the ruler's living children", () => {
    const ctx = makeContext({
      citizens: [
        makeCitizen({
          givenName: "Alaric",
          id: "ruler",
          roleNationId: "n1",
          roleType: "nation_manager",
          settlementId: "s1",
        }),
        makeCitizen({
          bornOnTurnNumber: 3,
          givenName: "Bram",
          id: "child-younger",
          parentACitizenId: "ruler",
          settlementId: "s1",
        }),
        makeCitizen({
          bornOnTurnNumber: 1,
          givenName: "Cora",
          id: "child-elder",
          parentACitizenId: "ruler",
          settlementId: "s1",
        }),
      ],
      nations: [makeNation({ governmentType: "monarchy", id: "n1", name: "Aldoria" })],
      settlements: [makeSettlement({ id: "s1", nationId: "n1" })],
    });

    const result = phaseSuccession(ctx, deathOf("ruler"));

    expect(result.logs).toHaveLength(1);
    expect(result.notifications).toHaveLength(1);

    expect(result.logs[0]).toMatchObject({
      category: "government.succession",
      citizenId: "ruler",
      nationId: "n1",
      phase: "succession",
      payload: {
        candidateCitizenIds: ["child-elder", "child-younger"],
        governmentType: "monarchy",
        successionMode: "hereditary",
      },
    });

    expect(result.notifications[0]).toEqual({
      messageText:
        "Ruler Alaric of Aldoria has died. Succession: hereditary. Candidates: Cora, Bram.",
      nationId: "n1",
      notificationType: "nation.succession",
      scope: "nation",
    });
  });
});

describe("phaseSuccession — republic (office_election)", () => {
  it("reports no candidates because no offices schema tracks senators yet", () => {
    const ctx = makeContext({
      citizens: [
        makeCitizen({
          givenName: "Elena",
          id: "ruler",
          roleNationId: "n1",
          roleType: "nation_manager",
          settlementId: "s1",
        }),
      ],
      nations: [makeNation({ governmentType: "republic", id: "n1", name: "Veneria" })],
      settlements: [makeSettlement({ id: "s1", nationId: "n1" })],
    });

    const result = phaseSuccession(ctx, deathOf("ruler"));

    expect(result.logs).toHaveLength(1);
    expect(result.logs[0]?.payload).toMatchObject({
      candidateCitizenIds: [],
      successionMode: "office_election",
    });
    expect(result.notifications).toEqual([
      {
        messageText:
          "Ruler Elena of Veneria has died. Succession: office_election. Candidates: none.",
        nationId: "n1",
        notificationType: "nation.succession",
        scope: "nation",
      },
    ]);
  });
});

describe("phaseSuccession — despotism (none)", () => {
  it("reports no candidates", () => {
    const ctx = makeContext({
      citizens: [
        makeCitizen({
          givenName: "Tyrant",
          id: "ruler",
          roleNationId: "n1",
          roleType: "nation_manager",
          settlementId: "s1",
        }),
      ],
      nations: [makeNation({ governmentType: "despotism", id: "n1", name: "Grimhold" })],
      settlements: [makeSettlement({ id: "s1", nationId: "n1" })],
    });

    const result = phaseSuccession(ctx, deathOf("ruler"));

    expect(result.logs[0]?.payload).toMatchObject({
      candidateCitizenIds: [],
      successionMode: "none",
    });
    expect(result.notifications[0]?.messageText).toContain("Candidates: none.");
  });
});

describe("phaseSuccession — no behavior change for non-ruler deaths", () => {
  it("emits nothing when a settlement manager or plain citizen dies", () => {
    const ctx = makeContext({
      citizens: [
        makeCitizen({
          givenName: "Alaric",
          id: "ruler",
          roleNationId: "n1",
          roleType: "nation_manager",
          settlementId: "s1",
        }),
        makeCitizen({
          givenName: "Manager",
          id: "manager",
          roleSettlementId: "s1",
          roleType: "settlement_manager",
          settlementId: "s1",
        }),
        makeCitizen({ givenName: "Plain", id: "plain", settlementId: "s1" }),
      ],
      nations: [makeNation({ governmentType: "monarchy", id: "n1", name: "Aldoria" })],
      settlements: [makeSettlement({ id: "s1", nationId: "n1" })],
    });

    const result = phaseSuccession(ctx, [...deathOf("manager"), ...deathOf("plain")]);

    expect(result.logs).toHaveLength(0);
    expect(result.notifications).toHaveLength(0);
  });
});
