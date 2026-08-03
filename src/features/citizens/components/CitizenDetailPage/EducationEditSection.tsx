import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { educationLevelsByWorldQueryOptions } from "@/features/education";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { setCitizenEducationMutationOptions } from "../../mutations/citizensMutations";

import type { Citizen } from "../../types/citizenTypes";
import type { JSX } from "react";

export function CitizenEducationEditSection({
  canEdit,
  citizen,
  queryClient,
}: {
  readonly canEdit: boolean;
  readonly citizen: Citizen;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const educationLevelsQuery = useQuery(
    educationLevelsByWorldQueryOptions(citizen.worldId),
  );
  const educationLevels = educationLevelsQuery.data ?? [];
  const noEducationSystem =
    educationLevelsQuery.isSuccess && educationLevels.length === 0;
  const mutation = useMutation(
    setCitizenEducationMutationOptions({ queryClient }),
  );

  function handleEducationChange(educationLevelId: string | null): void {
    if (educationLevelId === citizen.educationLevelId) return;
    mutation.mutate(
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
    <Card
      aria-labelledby="citizen-education-heading"
      className="grid gap-3 p-4"
    >
      <h2 id="citizen-education-heading" className="text-base font-medium">
        Education level
      </h2>
      {noEducationSystem ? null : (
        <p className="text-xs text-muted-foreground">
          Changes save immediately.
        </p>
      )}
      {noEducationSystem ? (
        <p className="text-sm italic text-muted-foreground">
          No education system configured for this world.
        </p>
      ) : (
        <Label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Education level</span>
          <NativeSelect
            aria-label="Education level"
            disabled={!canEdit || mutation.isPending}
            value={citizen.educationLevelId ?? ""}
            onChange={(event) => {
              const next = event.currentTarget.value;
              handleEducationChange(next === "" ? null : next);
            }}
          >
            <option value="">Uneducated</option>
            {educationLevels.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </NativeSelect>
        </Label>
      )}
    </Card>
  );
}
