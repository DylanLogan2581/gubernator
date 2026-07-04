import { Clock } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";

import { TurnLogBrowser } from "./TurnLogBrowser";

import type { JSX } from "react";

type TurnLogPageProps = {
  readonly worldId: string;
};

export function TurnLogPage({ worldId }: TurnLogPageProps): JSX.Element {
  return (
    <div className="container max-w-6xl space-y-6 py-6">
      <PageHeader
        icon={Clock}
        title="Turn history"
        description="Audit log of all simulation events across every turn transition."
      />

      <TurnLogBrowser worldId={worldId} title="All turn log entries" />
    </div>
  );
}
