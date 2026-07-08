import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { culturesByWorldQueryOptions } from "@/features/cultures";
import { educationLevelsByWorldQueryOptions } from "@/features/education";
import { activePartnershipForCitizenQueryOptions } from "@/features/partnerships";
import { religionsByWorldQueryOptions } from "@/features/religions";
import type { Settlement } from "@/features/settlements";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import {
  setCitizenCultureReligionMutationOptions,
  setCitizenEducationMutationOptions,
} from "../../mutations/citizensMutations";
import { citizenByIdQueryOptions } from "../../queries/citizensQueries";
import { managerScopeLabel } from "../../utils/citizenRoles";
import { CitizenAvatar } from "../CitizenAvatar";

import { bornOnTurnReadout } from "./BornOnTurnReadout";
import { CitizenDetailHeader } from "./Header";
import { CultureReligionChip, Readout } from "./Shared";

import type { Citizen } from "../../types/citizenTypes";
import type { JSX } from "react";

export function CitizenIdentityCard({
  canAdmin,
  citizen,
  queryClient,
  settlement,
}: {
  readonly canAdmin: boolean;
  readonly citizen: Citizen;
  readonly queryClient: QueryClient;
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

  const [isEditingCultureReligion, setIsEditingCultureReligion] =
    useState(false);
  const culturesQuery = useQuery(culturesByWorldQueryOptions(citizen.worldId));
  const religionsQuery = useQuery(
    religionsByWorldQueryOptions(citizen.worldId),
  );
  const cultureReligionMutation = useMutation(
    setCitizenCultureReligionMutationOptions({ queryClient }),
  );
  const culture =
    culturesQuery.data?.find((c) => c.id === citizen.cultureId) ?? null;
  const religion =
    religionsQuery.data?.find((r) => r.id === citizen.religionId) ?? null;

  function handleCultureChange(cultureId: string | null): void {
    if (cultureId === citizen.cultureId) return;
    cultureReligionMutation.mutate(
      { citizenId: citizen.id, cultureId, religionId: citizen.religionId },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to update culture.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Culture updated.");
        },
      },
    );
  }

  function handleReligionChange(religionId: string | null): void {
    if (religionId === citizen.religionId) return;
    cultureReligionMutation.mutate(
      { citizenId: citizen.id, cultureId: citizen.cultureId, religionId },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to update religion.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Religion updated.");
        },
      },
    );
  }

  const [isEditingEducation, setIsEditingEducation] = useState(false);
  const educationLevelsQuery = useQuery(
    educationLevelsByWorldQueryOptions(citizen.worldId),
  );
  const educationMutation = useMutation(
    setCitizenEducationMutationOptions({ queryClient }),
  );
  const educationLevel =
    educationLevelsQuery.data?.find(
      (level) => level.id === citizen.educationLevelId,
    ) ?? null;

  function handleEducationChange(educationLevelId: string | null): void {
    if (educationLevelId === citizen.educationLevelId) return;
    educationMutation.mutate(
      { citizenId: citizen.id, educationLevelId },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to update education level.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Education level updated.");
        },
      },
    );
  }

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

      {canAdmin && isEditingCultureReligion ? (
        <div className="grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
          <Label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Culture</span>
            <NativeSelect
              aria-label="Culture"
              disabled={cultureReligionMutation.isPending}
              value={citizen.cultureId ?? ""}
              onChange={(event) => {
                const next = event.currentTarget.value;
                handleCultureChange(next === "" ? null : next);
              }}
            >
              <option value="">None</option>
              {culturesQuery.data?.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </NativeSelect>
          </Label>
          <Label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Religion</span>
            <NativeSelect
              aria-label="Religion"
              disabled={cultureReligionMutation.isPending}
              value={citizen.religionId ?? ""}
              onChange={(event) => {
                const next = event.currentTarget.value;
                handleReligionChange(next === "" ? null : next);
              }}
            >
              <option value="">None</option>
              {religionsQuery.data?.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </NativeSelect>
          </Label>
          <button
            type="button"
            className="text-sm text-muted-foreground underline sm:col-span-2 sm:justify-self-start"
            onClick={() => setIsEditingCultureReligion(false)}
          >
            Done
          </button>
        </div>
      ) : (
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
              <CultureReligionChip
                color={religion.color}
                name={religion.name}
              />
            )}
          </div>
          {canAdmin ? (
            <button
              type="button"
              className="text-sm text-muted-foreground underline sm:col-span-2 sm:justify-self-start"
              onClick={() => setIsEditingCultureReligion(true)}
            >
              Edit culture/religion
            </button>
          ) : null}
        </div>
      )}

      {canAdmin && isEditingEducation ? (
        <div className="grid gap-3 rounded-md border border-border p-3">
          <Label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Education level</span>
            <NativeSelect
              aria-label="Education level"
              disabled={educationMutation.isPending}
              value={citizen.educationLevelId ?? ""}
              onChange={(event) => {
                const next = event.currentTarget.value;
                handleEducationChange(next === "" ? null : next);
              }}
            >
              <option value="">Uneducated</option>
              {educationLevelsQuery.data?.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </NativeSelect>
          </Label>
          <button
            type="button"
            className="text-sm text-muted-foreground underline justify-self-start"
            onClick={() => setIsEditingEducation(false)}
          >
            Done
          </button>
        </div>
      ) : (
        <div className="grid gap-1 text-sm">
          <span className="text-xs text-muted-foreground">Education level</span>
          <div className="flex items-center gap-2">
            <Badge variant={educationLevel === null ? "outline" : "secondary"}>
              {educationLevel?.name ?? "Uneducated"}
            </Badge>
            {canAdmin ? (
              <button
                type="button"
                className="text-sm text-muted-foreground underline"
                onClick={() => setIsEditingEducation(true)}
              >
                Edit
              </button>
            ) : null}
          </div>
        </div>
      )}
    </Card>
  );
}
