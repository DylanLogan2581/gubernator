import { useNavigate } from "@tanstack/react-router";
import { Clock } from "lucide-react";

import { PageHeader } from "@/components/shared/PageHeader";

import { TurnLogBrowser } from "./TurnLogBrowser";

import type { JSX } from "react";

type TurnLogPageProps = {
  readonly selectedTurn?: number | "all";
  readonly worldId: string;
};

export function TurnLogPage({
  selectedTurn,
  worldId,
}: TurnLogPageProps): JSX.Element {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={Clock}
        title="Turn history"
        description="Audit log of all simulation events across every turn transition."
      />

      <TurnLogBrowser
        onSelectedTurnChange={(turn) => {
          void navigate({
            to: "/worlds/$worldId/history",
            params: { worldId },
            search: (prev) => ({
              ...prev,
              turn: turn === "all" ? "all" : turn,
            }),
            replace: true,
          });
        }}
        selectedTurn={selectedTurn}
        title={null}
        worldId={worldId}
      />
    </div>
  );
}
