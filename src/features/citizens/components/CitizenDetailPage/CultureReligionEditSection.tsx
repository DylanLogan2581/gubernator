import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { culturesByWorldQueryOptions } from "@/features/cultures";
import { religionsByWorldQueryOptions } from "@/features/religions";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { setCitizenCultureReligionMutationOptions } from "../../mutations/citizensMutations";

import type { Citizen } from "../../types/citizenTypes";
import type { JSX } from "react";

export function CitizenCultureReligionEditSection({
  canEdit,
  citizen,
  queryClient,
}: {
  readonly canEdit: boolean;
  readonly citizen: Citizen;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const culturesQuery = useQuery(culturesByWorldQueryOptions(citizen.worldId));
  const religionsQuery = useQuery(
    religionsByWorldQueryOptions(citizen.worldId),
  );
  const mutation = useMutation(
    setCitizenCultureReligionMutationOptions({ queryClient }),
  );

  function handleCultureChange(cultureId: string | null): void {
    if (cultureId === citizen.cultureId) return;
    mutation.mutate(
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
    mutation.mutate(
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

  return (
    <Card
      aria-labelledby="citizen-culture-religion-heading"
      className="grid gap-3 p-4 sm:grid-cols-2"
    >
      <h2
        id="citizen-culture-religion-heading"
        className="text-base font-medium sm:col-span-2"
      >
        Culture and religion
      </h2>
      <Label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Culture</span>
        <NativeSelect
          aria-label="Culture"
          disabled={!canEdit || mutation.isPending}
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
          disabled={!canEdit || mutation.isPending}
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
    </Card>
  );
}
