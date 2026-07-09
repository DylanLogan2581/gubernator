import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { citizensInSettlementQueryOptions } from "@/features/citizens";
import { getErrorDescription } from "@/lib/errorUtils";

import type { SettlementWithNation } from "../../types/settlementTypes";
import type { JSX } from "react";

// Read-only "mayor" card for the settlement government tab (#1115): shows
// the citizen currently holding the settlement_manager role for this
// settlement, if any. Assignment/revocation happens from the nation's
// government tab (RoleAssignmentSection, Epic 11 #1080) -- this card only
// surfaces who currently holds it.
export function SettlementManagerCard({
  settlement,
}: {
  readonly settlement: SettlementWithNation;
}): JSX.Element {
  const citizensQuery = useQuery(
    citizensInSettlementQueryOptions(settlement.id),
  );

  if (citizensQuery.isPending) {
    return (
      <ManagerCardFrame>
        <LoadingState label="Loading manager…" />
      </ManagerCardFrame>
    );
  }

  if (citizensQuery.isError) {
    return (
      <ManagerCardFrame>
        <ErrorState
          title="Manager could not be loaded"
          description={getErrorDescription(citizensQuery.error)}
        />
      </ManagerCardFrame>
    );
  }

  const manager = citizensQuery.data.find(
    (citizen) =>
      citizen.roleType === "settlement_manager" &&
      citizen.roleSettlementId === settlement.id &&
      citizen.status === "alive",
  );

  return (
    <ManagerCardFrame>
      {manager === undefined ? (
        <p className="text-sm text-muted-foreground">
          No settlement manager is currently assigned.
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Link
            to="/worlds/$worldId/citizens/$citizenId"
            params={{ citizenId: manager.id, worldId: manager.worldId }}
            className="font-medium underline-offset-2 hover:underline"
          >
            {manager.name}
          </Link>
          <Badge
            variant={manager.citizenType === "npc" ? "secondary" : "outline"}
          >
            {manager.citizenType === "npc" ? "NPC" : "Player character"}
          </Badge>
        </div>
      )}
    </ManagerCardFrame>
  );
}

function ManagerCardFrame({
  children,
}: {
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <Card
      aria-labelledby="settlement-manager-heading"
      className="grid gap-2 p-4"
    >
      <h2 id="settlement-manager-heading" className="text-base font-medium">
        Mayor
      </h2>
      {children}
    </Card>
  );
}
