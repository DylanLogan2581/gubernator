import { TurnLogBrowser } from "./TurnLogBrowser";

import type { JSX } from "react";

type TurnLogPageProps = {
  readonly worldId: string;
};

export function TurnLogPage({ worldId }: TurnLogPageProps): JSX.Element {
  return (
    <div className="container max-w-6xl space-y-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-normal">Turn history</h1>
        <p className="text-sm text-muted-foreground">
          Audit log of all simulation events across every turn transition.
        </p>
      </header>

      <TurnLogBrowser worldId={worldId} title="All turn log entries" />
    </div>
  );
}
