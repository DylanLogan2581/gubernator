import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { culturesByWorldQueryOptions } from "@/features/cultures";
import { educationLevelsByWorldQueryOptions } from "@/features/education";
import { activePartnershipForCitizenQueryOptions } from "@/features/partnerships";
import { religionsByWorldQueryOptions } from "@/features/religions";
import type { Settlement } from "@/features/settlements";

import { citizenByIdQueryOptions } from "../../queries/citizensQueries";
import { managerScopeLabel } from "../../utils/citizenRoles";
import { CitizenAvatar } from "../CitizenAvatar";

import { bornOnTurnReadout } from "./BornOnTurnReadout";
import { CitizenDetailHeader } from "./Header";
import { CultureReligionChip, Readout } from "./Shared";

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

  const culturesQuery = useQuery(culturesByWorldQueryOptions(citizen.worldId));
  const religionsQuery = useQuery(
    religionsByWorldQueryOptions(citizen.worldId),
  );
  const culture =
    culturesQuery.data?.find((c) => c.id === citizen.cultureId) ?? null;
  const religion =
    religionsQuery.data?.find((r) => r.id === citizen.religionId) ?? null;

  const educationLevelsQuery = useQuery(
    educationLevelsByWorldQueryOptions(citizen.worldId),
  );
  const educationLevel =
    educationLevelsQuery.data?.find(
      (level) => level.id === citizen.educationLevelId,
    ) ?? null;

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

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Culture</span>
          {culture === null ? (
            <span className="text-sm italic text-muted-foreground">
              Not set
            </span>
          ) : (
            <CultureReligionChip color={culture.color} name={culture.name} />
          )}
        </div>
        <div className="grid gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Religion</span>
          {religion === null ? (
            <span className="text-sm italic text-muted-foreground">
              Not set
            </span>
          ) : (
            <CultureReligionChip color={religion.color} name={religion.name} />
          )}
        </div>
      </div>

      <div className="grid gap-1 text-sm">
        <span className="text-xs text-muted-foreground">Education level</span>
        <Badge variant={educationLevel === null ? "outline" : "secondary"}>
          {educationLevel?.name ?? "Uneducated"}
        </Badge>
      </div>
    </Card>
  );
}
