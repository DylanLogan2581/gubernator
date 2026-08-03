import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { WorldTurnPauseOverlay } from "./WorldTurnPauseOverlay";

import type { WorldTurnPauseState } from "../hooks/useWorldTurnPause";

const acknowledge = vi.fn();
const useWorldTurnPause = vi.fn();

vi.mock("../hooks/useWorldTurnPause", () => ({
  useWorldTurnPause: (worldId: string) => useWorldTurnPause(worldId) as unknown,
}));

function setState(state: WorldTurnPauseState): void {
  useWorldTurnPause.mockReturnValue({ acknowledge, state });
}

const WORLD_ID = "11111111-1111-1111-1111-111111111111";

describe("WorldTurnPauseOverlay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when idle", () => {
    setState({ kind: "idle" });

    const { container } = render(<WorldTurnPauseOverlay worldId={WORLD_ID} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("shows the phase label and elapsed time while running, with no dismiss", () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-08-03T12:01:07.000Z"));
    setState({
      kind: "running",
      stage: "standard_jobs",
      startedAt: "2026-08-03T12:00:00.000Z",
      toTurnNumber: 7,
    });

    render(<WorldTurnPauseOverlay worldId={WORLD_ID} />);

    expect(screen.getByText("Advancing to turn 7")).toBeInTheDocument();
    expect(screen.getByText("Working jobs")).toBeInTheDocument();
    expect(screen.getByText("1:07")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    vi.useRealTimers();
  });

  it("acknowledges from the completed state", async () => {
    const user = userEvent.setup();
    setState({ kind: "acknowledge", toTurnNumber: 7 });

    render(<WorldTurnPauseOverlay worldId={WORLD_ID} />);
    await user.click(
      screen.getByRole("button", { name: "Continue to turn 7" }),
    );

    expect(acknowledge).toHaveBeenCalledOnce();
  });

  it("keeps players blocked with a neutral message on failure", () => {
    setState({ kind: "failed", toTurnNumber: 7 });

    render(<WorldTurnPauseOverlay worldId={WORLD_ID} />);

    expect(screen.getByText("Turn paused")).toBeInTheDocument();
    expect(
      screen.getByText(
        "The turn did not complete. An administrator has been notified.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
