import { useQuery } from "@tanstack/react-query";

import { Card } from "@/components/ui/card";
import { activePartnershipForCitizenQueryOptions } from "@/features/partnerships";
import type { Settlement } from "@/features/settlements";

import { citizenByIdQueryOptions } from "../../queries/citizensQueries";
import { managerScopeLabel } from "../../utils/citizenRoles";
import { CitizenAvatar } from "../CitizenAvatar";

import { bornOnTurnReadout } from "./BornOnTurnReadout";
import { CitizenDetailHeader } from "./Header";
import { Readout } from "./Shared";

import type { Citizen } from "../../types/citizenTypes";
import type { JSX } from "react";

export function CitizenIdentityCard({
  citizen,
  settlement,
}: {
  readonly citizen: Citizen;
  readonly settlement: Settlement | null;
}): JSX.Element {
  const activePartnershipQuery = useQuery(
    activePartnershipForCitizenQueryOptions(citizen.id),
  );
  const activePartnership = activePartnershipQuery.data ?? null;
  const partnerId =
    activePartnership === null
      ? null
      : activePartnership.citizenAId === citizen.id
        ? activePartnership.citizenBId
        : activePartnership.citizenAId;
  const partnerQuery = useQuery({
    ...citizenByIdQueryOptions(partnerId ?? ""),
    enabled: partnerId !== null,
  });

  const bornOnTurn = bornOnTurnReadout(citizen);
  const roleScope = managerScopeLabel(citizen.roleType);

  const partnershipValue = activePartnershipQuery.isPending
    ? null
    : partnerId === null
      ? "No active partnership"
      : (partnerQuery.data?.name ?? "Loading…");

  return (
    <Card className="grid gap-4 p-4">
      <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:items-start sm:text-left">
        <CitizenAvatar
          id={citizen.id}
          name={citizen.name}
          profilePhotoUrl={citizen.profilePhotoUrl}
          size="lg"
        />
        <CitizenDetailHeader citizen={citizen} />
      </div>

      <dl className="grid gap-2">
        <Readout label="Sex" value={citizen.sex} />
        <Readout
          label="Born on turn"
          tooltip={bornOnTurn.tooltip}
          value={bornOnTurn.value}
        />
        {roleScope === null ? null : (
          <Readout
            label="Role"
            value={
              roleScope === "nation" ? "Nation manager" : "Settlement manager"
            }
          />
        )}
        <Readout label="Home settlement" value={settlement?.name ?? null} />
        <Readout label="Partnership" value={partnershipValue} />
      </dl>
    </Card>
  );
}
