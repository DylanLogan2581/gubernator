import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { culturesByWorldQueryOptions } from "@/features/cultures";
import { educationLevelsByWorldQueryOptions } from "@/features/education";
import { activePartnershipForCitizenQueryOptions } from "@/features/partnerships";
import { religionsByWorldQueryOptions } from "@/features/religions";
import type { Settlement } from "@/features/settlements";
import { worldPopulationRulesQueryOptions } from "@/features/worlds";

import { citizenByIdQueryOptions } from "../../queries/citizensQueries";
import { managerScopeLabel } from "../../utils/citizenRoles";

import { bornOnTurnReadout } from "./BornOnTurnReadout";
import { citizenAgeTurns, isBelowPartnershipAge } from "./CitizenAge";
import { CultureReligionChip, Readout } from "./Shared";

import type { Citizen } from "../../types/citizenTypes";
import type { JSX } from "react";

export function CitizenIdentityCard({
  citizen,
  currentTurnNumber,
  settlement,
}: {
  readonly citizen: Citizen;
  readonly currentTurnNumber: number;
  readonly settlement: Settlement | null;
}): JSX.Element {
  const activePartnershipQuery = useQuery(
    activePartnershipForCitizenQueryOptions(citizen.id),
  );
  const populationRulesQuery = useQuery(
    worldPopulationRulesQueryOptions(citizen.worldId),
  );
  const ageTurns = citizenAgeTurns(citizen.bornOnTurnNumber, currentTurnNumber);
  const belowPartnershipAge = isBelowPartnershipAge(
    ageTurns,
    populationRulesQuery.data?.minimum_partnership_age_turns ?? null,
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

  const partnershipValue = belowPartnershipAge
    ? "Not yet of partnership age"
    : activePartnershipQuery.isPending
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
  const educationLevels = educationLevelsQuery.data ?? [];
  const educationLevel =
    educationLevels.find((level) => level.id === citizen.educationLevelId) ??
    null;
  const noEducationSystem =
    educationLevelsQuery.isSuccess && educationLevels.length === 0;

  return (
    <Card className="grid gap-4 p-4">
      <dl className="grid divide-y divide-border border-y border-border">
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

      <dl className="grid divide-y divide-border border-y border-border">
        <Readout label="Culture">
          {culture === null ? undefined : (
            <CultureReligionChip color={culture.color} name={culture.name} />
          )}
        </Readout>
        <Readout label="Religion">
          {religion === null ? undefined : (
            <CultureReligionChip color={religion.color} name={religion.name} />
          )}
        </Readout>
      </dl>

      <dl className="grid divide-y divide-border border-y border-border">
        <Readout label="Education level">
          {noEducationSystem ? (
            <span className="italic text-muted-foreground">
              No education system configured
            </span>
          ) : (
            <Badge variant={educationLevel === null ? "outline" : "secondary"}>
              {educationLevel?.name ?? "Uneducated"}
            </Badge>
          )}
        </Readout>
      </dl>
    </Card>
  );
}
