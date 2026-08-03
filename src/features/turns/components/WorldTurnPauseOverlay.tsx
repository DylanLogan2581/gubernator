import { type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

import { useTickingNow } from "../hooks/useTickingNow";
import { useWorldTurnPause } from "../hooks/useWorldTurnPause";
import { formatElapsed, getTurnPhaseLabel } from "../utils/turnPhaseLabels";

import type { TurnTransitionProgressStage } from "../types/turnTransitionStatusTypes";

type WorldTurnPauseOverlayProps = {
  readonly worldId: string;
};

type RunningStateProps = {
  readonly stage: TurnTransitionProgressStage | null;
  readonly startedAt: string;
  readonly toTurnNumber: number;
};

// Covers every world-scoped route while a turn advances. The database guard is
// what actually rejects writes; this is the explanation, and the explicit
// acknowledgment is what guarantees nobody reads pre-turn numbers as current.
// Deliberately not dismissible: no close control, no backdrop click, no Escape.
export function WorldTurnPauseOverlay({
  worldId,
}: WorldTurnPauseOverlayProps): JSX.Element | null {
  const { acknowledge, state } = useWorldTurnPause(worldId);

  if (state.kind === "idle") {
    return null;
  }

  return (
    <div
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-background/95 p-6 backdrop-blur-sm"
      role="dialog"
    >
      <div className="grid w-full max-w-md gap-4 rounded-lg border border-border bg-card p-6 shadow-lg">
        {state.kind === "running" ? (
          <RunningState
            stage={state.stage}
            startedAt={state.startedAt}
            toTurnNumber={state.toTurnNumber}
          />
        ) : null}

        {state.kind === "acknowledge" ? (
          <>
            <h2 className="text-lg font-semibold">
              {`Turn ${state.toTurnNumber.toString()} is ready`}
            </h2>
            <p className="text-sm text-muted-foreground">
              The world has advanced. Continue to see the new turn.
            </p>
            <Button onClick={acknowledge}>
              {`Continue to turn ${state.toTurnNumber.toString()}`}
            </Button>
          </>
        ) : null}

        {state.kind === "failed" ? (
          <>
            <h2 className="text-lg font-semibold">Turn paused</h2>
            <p className="text-sm text-muted-foreground">
              The turn did not complete. An administrator has been notified.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}

// Players stay here for the whole run, so the elapsed timer matters: it is the
// difference between "working" and "hung" when a phase is slow.
function RunningState({
  stage,
  startedAt,
  toTurnNumber,
}: RunningStateProps): JSX.Element {
  const now = useTickingNow();

  return (
    <>
      <h2 className="text-lg font-semibold">
        {`Advancing to turn ${toTurnNumber.toString()}`}
      </h2>
      <div aria-live="polite" className="grid gap-2" role="status">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm">{getTurnPhaseLabel(stage)}</p>
          <p className="text-sm tabular-nums text-muted-foreground">
            {formatElapsed(startedAt, now)}
          </p>
        </div>
        {/* Indeterminate: phase order is fixed but phase duration is not, so a
            percentage would misrepresent how far along the turn is. */}
        <Progress
          aria-label="Turn transition progress"
          aria-valuetext={getTurnPhaseLabel(stage)}
          className="h-2"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        The world is locked until the turn finishes.
      </p>
    </>
  );
}
