import { describe, expect, it } from "vitest";

import {
  AmendmentProcedureValidationError,
  assertAmendmentProcedureBodiesExist,
  canProposeAmendment,
  evaluateVote,
  validateAmendmentProcedure,
  type AmendmentActor,
  type VoteAmendmentProcedure,
  type VoteMembers,
} from "@/shared/government";

const OFFICE_TYPE_ID = "11111111-1111-1111-1111-111111111111";
const BODY_ID = "22222222-2222-2222-2222-222222222222";
const SECOND_BODY_ID = "33333333-3333-3333-3333-333333333333";

describe("validateAmendmentProcedure", () => {
  it("accepts decree with ruler authority", () => {
    expect(
      validateAmendmentProcedure({ kind: "decree", authority: "ruler" }),
    ).toEqual({ kind: "decree", authority: "ruler" });
  });

  it("accepts decree with office authority", () => {
    expect(
      validateAmendmentProcedure({
        kind: "decree",
        authority: { officeTypeId: OFFICE_TYPE_ID },
      }),
    ).toEqual({
      kind: "decree",
      authority: { officeTypeId: OFFICE_TYPE_ID },
    });
  });

  it("rejects decree with malformed authority", () => {
    expect(() =>
      validateAmendmentProcedure({ kind: "decree", authority: "senate" }),
    ).toThrow(AmendmentProcedureValidationError);
    expect(() =>
      validateAmendmentProcedure({
        kind: "decree",
        authority: { officeTypeId: "not-a-uuid" },
      }),
    ).toThrow(AmendmentProcedureValidationError);
  });

  it("accepts a unicameral vote procedure", () => {
    expect(
      validateAmendmentProcedure({
        kind: "vote",
        bodyId: BODY_ID,
        threshold: "two_thirds",
        votingPeriodTurns: 3,
        secondBodyId: null,
      }),
    ).toEqual({
      kind: "vote",
      bodyId: BODY_ID,
      threshold: "two_thirds",
      votingPeriodTurns: 3,
      secondBodyId: null,
    });
  });

  it("accepts a bicameral vote procedure", () => {
    const result = validateAmendmentProcedure({
      kind: "vote",
      bodyId: BODY_ID,
      threshold: "majority",
      votingPeriodTurns: 1,
      secondBodyId: SECOND_BODY_ID,
    });
    expect(result).toMatchObject({ secondBodyId: SECOND_BODY_ID });
  });

  it("rejects vote with an invalid threshold", () => {
    expect(() =>
      validateAmendmentProcedure({
        kind: "vote",
        bodyId: BODY_ID,
        threshold: "plurality",
        votingPeriodTurns: 1,
        secondBodyId: null,
      }),
    ).toThrow(AmendmentProcedureValidationError);
  });

  it("rejects vote with a non-positive voting period", () => {
    expect(() =>
      validateAmendmentProcedure({
        kind: "vote",
        bodyId: BODY_ID,
        threshold: "majority",
        votingPeriodTurns: 0,
        secondBodyId: null,
      }),
    ).toThrow(AmendmentProcedureValidationError);
  });

  it("rejects vote whose second body equals the first", () => {
    expect(() =>
      validateAmendmentProcedure({
        kind: "vote",
        bodyId: BODY_ID,
        threshold: "majority",
        votingPeriodTurns: 1,
        secondBodyId: BODY_ID,
      }),
    ).toThrow("Second body must differ from first");
  });

  it("accepts locked", () => {
    expect(validateAmendmentProcedure({ kind: "locked" })).toEqual({
      kind: "locked",
    });
  });

  it("rejects a non-object value", () => {
    expect(() => validateAmendmentProcedure(null)).toThrow(
      AmendmentProcedureValidationError,
    );
    expect(() => validateAmendmentProcedure("decree")).toThrow(
      AmendmentProcedureValidationError,
    );
  });

  it("rejects an unknown kind", () => {
    expect(() => validateAmendmentProcedure({ kind: "referendum" })).toThrow(
      AmendmentProcedureValidationError,
    );
  });
});

describe("assertAmendmentProcedureBodiesExist", () => {
  it("passes when bodies are in scope", () => {
    const procedure = validateAmendmentProcedure({
      kind: "vote",
      bodyId: BODY_ID,
      threshold: "majority",
      votingPeriodTurns: 1,
      secondBodyId: SECOND_BODY_ID,
    });
    expect(() =>
      assertAmendmentProcedureBodiesExist(procedure, [BODY_ID, SECOND_BODY_ID]),
    ).not.toThrow();
  });

  it("throws Procedure body not found when the first body is out of scope", () => {
    const procedure = validateAmendmentProcedure({
      kind: "vote",
      bodyId: BODY_ID,
      threshold: "majority",
      votingPeriodTurns: 1,
      secondBodyId: null,
    });
    expect(() => assertAmendmentProcedureBodiesExist(procedure, [])).toThrow(
      "Procedure body not found",
    );
  });

  it("throws Procedure body not found when the second body is out of scope", () => {
    const procedure = validateAmendmentProcedure({
      kind: "vote",
      bodyId: BODY_ID,
      threshold: "majority",
      votingPeriodTurns: 1,
      secondBodyId: SECOND_BODY_ID,
    });
    expect(() =>
      assertAmendmentProcedureBodiesExist(procedure, [BODY_ID]),
    ).toThrow("Procedure body not found");
  });

  it("is a no-op for decree and locked procedures", () => {
    expect(() =>
      assertAmendmentProcedureBodiesExist(
        { kind: "decree", authority: "ruler" },
        [],
      ),
    ).not.toThrow();
    expect(() =>
      assertAmendmentProcedureBodiesExist({ kind: "locked" }, []),
    ).not.toThrow();
  });
});

function actor(overrides: Partial<AmendmentActor>): AmendmentActor {
  return {
    isWorldAdmin: false,
    isSuperAdmin: false,
    isRuler: false,
    heldOfficeTypeIds: [],
    memberOfBodyIds: [],
    ...overrides,
  };
}

describe("canProposeAmendment", () => {
  it("lets the ruler propose under ruler-authority decree", () => {
    expect(
      canProposeAmendment(
        { kind: "decree", authority: "ruler" },
        actor({ isRuler: true }),
      ),
    ).toBe(true);
    expect(
      canProposeAmendment(
        { kind: "decree", authority: "ruler" },
        actor({ isRuler: false }),
      ),
    ).toBe(false);
  });

  it("lets an office holder propose under office-authority decree", () => {
    const procedure = {
      kind: "decree",
      authority: { officeTypeId: OFFICE_TYPE_ID },
    } as const;
    expect(
      canProposeAmendment(
        procedure,
        actor({ heldOfficeTypeIds: [OFFICE_TYPE_ID] }),
      ),
    ).toBe(true);
    expect(canProposeAmendment(procedure, actor({}))).toBe(false);
  });

  it("lets only body members propose under a vote procedure", () => {
    const procedure: VoteAmendmentProcedure = {
      kind: "vote",
      bodyId: BODY_ID,
      threshold: "majority",
      votingPeriodTurns: 1,
      secondBodyId: SECOND_BODY_ID,
    };
    expect(
      canProposeAmendment(procedure, actor({ memberOfBodyIds: [BODY_ID] })),
    ).toBe(true);
    expect(
      canProposeAmendment(
        procedure,
        actor({ memberOfBodyIds: [SECOND_BODY_ID] }),
      ),
    ).toBe(true);
    expect(canProposeAmendment(procedure, actor({ isRuler: true }))).toBe(
      false,
    );
  });

  it("lets nobody but an admin propose under locked", () => {
    expect(canProposeAmendment({ kind: "locked" }, actor({}))).toBe(false);
    expect(
      canProposeAmendment({ kind: "locked" }, actor({ isWorldAdmin: true })),
    ).toBe(true);
    expect(
      canProposeAmendment({ kind: "locked" }, actor({ isSuperAdmin: true })),
    ).toBe(true);
  });

  it("lets an admin override any procedure kind", () => {
    const admin = actor({ isWorldAdmin: true });
    expect(
      canProposeAmendment({ kind: "decree", authority: "ruler" }, admin),
    ).toBe(true);
    expect(
      canProposeAmendment(
        {
          kind: "vote",
          bodyId: BODY_ID,
          threshold: "unanimous",
          votingPeriodTurns: 1,
          secondBodyId: null,
        },
        admin,
      ),
    ).toBe(true);
  });
});

const UNICAMERAL_MEMBERS: VoteMembers = {
  bodyMemberCitizenIds: ["c1", "c2", "c3", "c4"],
};

function unicameral(
  threshold: VoteAmendmentProcedure["threshold"],
): VoteAmendmentProcedure {
  return {
    kind: "vote",
    bodyId: BODY_ID,
    threshold,
    votingPeriodTurns: 1,
    secondBodyId: null,
  };
}

describe("evaluateVote thresholds", () => {
  it("majority passes on more than half yes", () => {
    const votes = [
      { citizenId: "c1", choice: "yes" as const },
      { citizenId: "c2", choice: "yes" as const },
      { citizenId: "c3", choice: "no" as const },
      { citizenId: "c4", choice: "no" as const },
    ];
    expect(
      evaluateVote(unicameral("majority"), votes, UNICAMERAL_MEMBERS).passed,
    ).toBe(false); // exactly half is not a majority

    const passingVotes = [
      ...votes.slice(0, 3).map((v) => ({ ...v, choice: "yes" as const })),
    ];
    expect(
      evaluateVote(unicameral("majority"), passingVotes, UNICAMERAL_MEMBERS)
        .passed,
    ).toBe(true);
  });

  it("two_thirds requires at least 2/3 of members voting yes", () => {
    const votes = [
      { citizenId: "c1", choice: "yes" as const },
      { citizenId: "c2", choice: "yes" as const },
      { citizenId: "c3", choice: "no" as const },
      { citizenId: "c4", choice: "no" as const },
    ];
    expect(
      evaluateVote(unicameral("two_thirds"), votes, UNICAMERAL_MEMBERS).passed,
    ).toBe(false);

    const threeYes = [
      { citizenId: "c1", choice: "yes" as const },
      { citizenId: "c2", choice: "yes" as const },
      { citizenId: "c3", choice: "yes" as const },
      { citizenId: "c4", choice: "no" as const },
    ];
    expect(
      evaluateVote(unicameral("two_thirds"), threeYes, UNICAMERAL_MEMBERS)
        .passed,
    ).toBe(true);
  });

  it("three_quarters requires at least 3/4 of members voting yes", () => {
    const threeYes = [
      { citizenId: "c1", choice: "yes" as const },
      { citizenId: "c2", choice: "yes" as const },
      { citizenId: "c3", choice: "yes" as const },
    ];
    expect(
      evaluateVote(unicameral("three_quarters"), threeYes, UNICAMERAL_MEMBERS)
        .passed,
    ).toBe(true);

    const twoYes = threeYes.slice(0, 2);
    expect(
      evaluateVote(unicameral("three_quarters"), twoYes, UNICAMERAL_MEMBERS)
        .passed,
    ).toBe(false);
  });

  it("unanimous requires every member to vote yes", () => {
    const allYes = ["c1", "c2", "c3", "c4"].map((citizenId) => ({
      citizenId,
      choice: "yes" as const,
    }));
    expect(
      evaluateVote(unicameral("unanimous"), allYes, UNICAMERAL_MEMBERS).passed,
    ).toBe(true);

    const oneAbstain = [
      ...allYes.slice(0, 3),
      { citizenId: "c4", choice: "abstain" as const },
    ];
    expect(
      evaluateVote(unicameral("unanimous"), oneAbstain, UNICAMERAL_MEMBERS)
        .passed,
    ).toBe(false);
  });

  it("counts a non-voting member against the threshold, same as an abstain", () => {
    // c4 casts no vote at all.
    const threeYesOneSilent = [
      { citizenId: "c1", choice: "yes" as const },
      { citizenId: "c2", choice: "yes" as const },
      { citizenId: "c3", choice: "yes" as const },
    ];
    const withExplicitAbstain = [
      ...threeYesOneSilent,
      { citizenId: "c4", choice: "abstain" as const },
    ];

    const silentResult = evaluateVote(
      unicameral("three_quarters"),
      threeYesOneSilent,
      UNICAMERAL_MEMBERS,
    );
    const abstainResult = evaluateVote(
      unicameral("three_quarters"),
      withExplicitAbstain,
      UNICAMERAL_MEMBERS,
    );

    expect(silentResult.passed).toBe(abstainResult.passed);
    expect(silentResult.firstChamber.nonVoters).toBe(1);
    expect(abstainResult.firstChamber.nonVoters).toBe(0);
    expect(abstainResult.firstChamber.abstain).toBe(1);
  });

  it("ignores votes cast by non-members", () => {
    const result = evaluateVote(
      unicameral("majority"),
      [
        { citizenId: "c1", choice: "yes" as const },
        { citizenId: "c2", choice: "yes" as const },
        { citizenId: "c3", choice: "yes" as const },
        { citizenId: "outsider", choice: "yes" as const },
      ],
      UNICAMERAL_MEMBERS,
    );
    expect(result.firstChamber.memberCount).toBe(4);
    expect(result.firstChamber.yes).toBe(3);
  });

  it("a later cast for the same citizen overrides an earlier one", () => {
    const result = evaluateVote(
      unicameral("majority"),
      [
        { citizenId: "c1", choice: "yes" as const },
        { citizenId: "c1", choice: "no" as const },
      ],
      UNICAMERAL_MEMBERS,
    );
    expect(result.firstChamber.yes).toBe(0);
    expect(result.firstChamber.no).toBe(1);
  });

  it("requires both chambers to pass in a bicameral procedure", () => {
    const procedure: VoteAmendmentProcedure = {
      kind: "vote",
      bodyId: BODY_ID,
      threshold: "majority",
      votingPeriodTurns: 1,
      secondBodyId: SECOND_BODY_ID,
    };
    const members: VoteMembers = {
      bodyMemberCitizenIds: ["c1", "c2"],
      secondBodyMemberCitizenIds: ["s1", "s2"],
    };

    const firstOnlyPasses = evaluateVote(
      procedure,
      [
        { citizenId: "c1", choice: "yes" as const },
        { citizenId: "c2", choice: "yes" as const },
        { citizenId: "s1", choice: "no" as const },
        { citizenId: "s2", choice: "no" as const },
      ],
      members,
    );
    expect(firstOnlyPasses.firstChamber.passed).toBe(true);
    expect(firstOnlyPasses.secondChamber?.passed).toBe(false);
    expect(firstOnlyPasses.passed).toBe(false);

    const bothPass = evaluateVote(
      procedure,
      [
        { citizenId: "c1", choice: "yes" as const },
        { citizenId: "c2", choice: "yes" as const },
        { citizenId: "s1", choice: "yes" as const },
        { citizenId: "s2", choice: "yes" as const },
      ],
      members,
    );
    expect(bothPass.passed).toBe(true);
  });

  it("never passes with zero members", () => {
    const result = evaluateVote(unicameral("majority"), [], {
      bodyMemberCitizenIds: [],
    });
    expect(result.passed).toBe(false);
  });
});
