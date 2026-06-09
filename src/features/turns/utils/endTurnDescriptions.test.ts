import { describe, expect, it } from "vitest";

import { EndTurnTransitionError } from "../mutations/endTurnTransitionMutations";

import {
  getControlDescription,
  getErrorDescription,
  getReadinessSummaryDescription,
} from "./endTurnDescriptions";

describe("getControlDescription", () => {
  it("returns archived message when world is archived", () => {
    expect(
      getControlDescription({
        isArchived: true,
        isPending: false,
        isReadinessUnavailable: false,
      }),
    ).toBe("End turn is disabled because this world is archived.");
  });

  it("returns readiness unavailable message when readiness cannot be loaded", () => {
    expect(
      getControlDescription({
        isArchived: false,
        isPending: false,
        isReadinessUnavailable: true,
      }),
    ).toBe("End turn is disabled until readiness can be reviewed.");
  });

  it("returns pending message while transition is running", () => {
    expect(
      getControlDescription({
        isArchived: false,
        isPending: true,
        isReadinessUnavailable: false,
      }),
    ).toBe("End-turn transition is running.");
  });

  it("returns empty description when ready", () => {
    expect(
      getControlDescription({
        isArchived: false,
        isPending: false,
        isReadinessUnavailable: false,
      }),
    ).toBe("");
  });

  it("prefers archived over readiness unavailable", () => {
    expect(
      getControlDescription({
        isArchived: true,
        isPending: false,
        isReadinessUnavailable: true,
      }),
    ).toBe("End turn is disabled because this world is archived.");
  });
});

describe("getReadinessSummaryDescription", () => {
  it("formats all-ready summary", () => {
    expect(
      getReadinessSummaryDescription({
        notReadySettlementCount: 0,
        readyPercentage: 100,
        readySettlementCount: 3,
        totalSettlementCount: 3,
      }),
    ).toBe("3 of 3 settlements ready (100%). 0 not ready.");
  });

  it("floors uneven percentages", () => {
    expect(
      getReadinessSummaryDescription({
        notReadySettlementCount: 1,
        readyPercentage: 66.66666666666666,
        readySettlementCount: 2,
        totalSettlementCount: 3,
      }),
    ).toBe("2 of 3 settlements ready (66%). 1 not ready.");
  });

  it("formats zero-ready summary", () => {
    expect(
      getReadinessSummaryDescription({
        notReadySettlementCount: 2,
        readyPercentage: 0,
        readySettlementCount: 0,
        totalSettlementCount: 2,
      }),
    ).toBe("0 of 2 settlements ready (0%). 2 not ready.");
  });
});

describe("getErrorDescription", () => {
  it("returns archived world message", () => {
    expect(
      getErrorDescription(
        new EndTurnTransitionError({
          code: "end_turn_archived_world",
          message: "",
          worldId: "w",
        }),
      ),
    ).toBe("This world is archived. End turn is unavailable.");
  });

  it("returns running transition message", () => {
    expect(
      getErrorDescription(
        new EndTurnTransitionError({
          code: "end_turn_running_transition",
          message: "",
          worldId: "w",
        }),
      ),
    ).toBe(
      "Another end-turn transition is already running. Refresh the page before trying again.",
    );
  });

  it("returns session expired message", () => {
    expect(
      getErrorDescription(
        new EndTurnTransitionError({
          code: "end_turn_session_expired",
          message: "",
          worldId: "w",
        }),
      ),
    ).toBe("Your session has expired. Please sign in again.");
  });

  it("returns stale turn message", () => {
    expect(
      getErrorDescription(
        new EndTurnTransitionError({
          code: "end_turn_stale_turn",
          message: "",
          worldId: "w",
        }),
      ),
    ).toBe(
      "This turn has already changed. Refresh the page to review the latest world state.",
    );
  });

  it("returns transition failed message", () => {
    expect(
      getErrorDescription(
        new EndTurnTransitionError({
          code: "end_turn_transition_failed",
          message: "",
          worldId: "w",
        }),
      ),
    ).toBe(
      "End turn could not be saved. Refresh the page before trying again.",
    );
  });

  it("returns unauthorized message", () => {
    expect(
      getErrorDescription(
        new EndTurnTransitionError({
          code: "end_turn_unauthorized",
          message: "",
          worldId: "w",
        }),
      ),
    ).toBe("End turn is unavailable for this world.");
  });

  it("returns generic fallback for non-EndTurnBasicError errors", () => {
    expect(getErrorDescription(new Error("unexpected"))).toBe(
      "Try refreshing the page. If the problem continues, contact an administrator.",
    );
  });

  it("returns generic fallback for non-error values", () => {
    expect(getErrorDescription(null)).toBe(
      "Try refreshing the page. If the problem continues, contact an administrator.",
    );
  });
});
