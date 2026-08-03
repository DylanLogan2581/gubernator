import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

import {
  getTurnProgressLabel,
  getTurnProgressPercentage,
} from "../utils/endTurnDescriptions";

import type { LatestTurnTransitionStatus } from "../types/turnTransitionStatusTypes";
import type { JSX } from "react";

type TurnTransitionProgressPanelProps = {
  readonly transition: LatestTurnTransitionStatus | null | undefined;
};

// The turn runs in a background worker (#1278), so the UI tracks the
// turn_transitions row instead of a blocking request: a live progress readout
// while it runs, and a persistent banner when it ended in failure.
export function TurnTransitionProgressPanel({
  transition,
}: TurnTransitionProgressPanelProps): JSX.Element | null {
  if (transition === null || transition === undefined) {
    return null;
  }

  if (transition.isRunning) {
    const percentage = getTurnProgressPercentage(transition.progressStage);

    return (
      <div
        aria-live="polite"
        className="grid gap-2 rounded-md border border-border bg-muted/40 p-4"
        role="status"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-medium">
            {`Advancing to turn ${transition.toTurnNumber.toString()}`}
          </p>
          <p className="text-sm text-muted-foreground">
            {getTurnProgressLabel(transition.progressStage)}
          </p>
        </div>
        {/* The vendored primitive keeps `value` local to the indicator, so the
            accessible value is supplied here rather than by editing it. */}
        <Progress
          aria-label="Turn transition progress"
          aria-valuenow={percentage}
          aria-valuetext={getTurnProgressLabel(transition.progressStage)}
          className="h-2"
          value={percentage}
        />
        <p className="text-xs text-muted-foreground">
          You can keep using the app while the turn runs.
        </p>
      </div>
    );
  }

  if (transition.state === "failed") {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Last turn transition failed</AlertTitle>
        <AlertDescription>
          {`The background run for turn ${transition.toTurnNumber.toString()} did not finish. Review the world state, then run the turn transition again.`}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
