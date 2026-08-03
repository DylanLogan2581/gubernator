import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TurnTransitionProgressPanel } from "./TurnTransitionProgressPanel";

import type { LatestTurnTransitionStatus } from "../types/turnTransitionStatusTypes";

describe("TurnTransitionProgressPanel", () => {
  it("renders nothing when no transition has run", () => {
    const { container } = render(
      <TurnTransitionProgressPanel transition={null} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while the status is still loading", () => {
    const { container } = render(
      <TurnTransitionProgressPanel transition={undefined} />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("reports the worker stage and progress while the turn runs", () => {
    render(
      <TurnTransitionProgressPanel
        transition={createTransition({
          isRunning: true,
          progressStage: "simulating",
          state: "running",
        })}
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent("Advancing to turn 8");
    expect(screen.getByText("simulating the turn")).toBeDefined();
    expect(
      screen.getByRole("progressbar", { name: "Turn transition progress" }),
    ).toHaveAttribute("aria-valuenow", "70");
  });

  it("falls back to a waiting label before the worker claims the job", () => {
    render(
      <TurnTransitionProgressPanel
        transition={createTransition({ isRunning: true, state: "running" })}
      />,
    );

    expect(screen.getByText("waiting to start")).toBeDefined();
    expect(
      screen.getByRole("progressbar", { name: "Turn transition progress" }),
    ).toHaveAttribute("aria-valuenow", "10");
  });

  it("surfaces a failed background run", () => {
    render(
      <TurnTransitionProgressPanel
        transition={createTransition({ state: "failed" })}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Last turn transition failed",
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "The background run for turn 8 did not finish.",
    );
  });

  it("renders nothing for a completed transition", () => {
    const { container } = render(
      <TurnTransitionProgressPanel
        transition={createTransition({ state: "completed" })}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});

function createTransition(
  overrides: Partial<LatestTurnTransitionStatus> = {},
): LatestTurnTransitionStatus {
  return {
    finishedAt: null,
    fromTurnNumber: 7,
    id: "transition-1",
    isRunning: false,
    progressStage: null,
    startedAt: "2026-07-17T00:00:00.000Z",
    state: "completed",
    toTurnNumber: 8,
    worldId: "world-1",
    ...overrides,
  };
}
