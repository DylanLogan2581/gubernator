import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

import type { LatestTurnTransitionStatus } from "../types/turnTransitionStatusTypes";
import type { JSX } from "react";

type TurnTransitionProgressPanelProps = {
  readonly transition: LatestTurnTransitionStatus | null | undefined;
};

// Running progress is now shown by WorldTurnPauseOverlay, which covers every
// world-scoped route; this panel keeps only the admin-facing failure detail
// that the overlay deliberately omits.
export function TurnTransitionProgressPanel({
  transition,
}: TurnTransitionProgressPanelProps): JSX.Element | null {
  if (transition === null || transition === undefined) {
    return null;
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
