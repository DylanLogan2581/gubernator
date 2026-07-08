import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Landmark } from "lucide-react";
import { type JSX } from "react";

import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { culturesByWorldQueryOptions } from "@/features/cultures";
import { useActivePlayerCharacter } from "@/features/permissions";
import { religionsByWorldQueryOptions } from "@/features/religions";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { setNationCultureReligionMutationOptions } from "../../mutations/nationsMutations";

import type { Nation } from "../../types/nationTypes";

export function NationCultureReligionSection({
  canAdminWorld,
  isArchived,
  nation,
}: {
  readonly canAdminWorld: boolean;
  readonly isArchived: boolean;
  readonly nation: Nation;
}): JSX.Element {
  const { activeCharacter } = useActivePlayerCharacter();
  const isNationManager =
    activeCharacter !== null &&
    activeCharacter.roleType === "nation_manager" &&
    activeCharacter.roleNationId === nation.id &&
    activeCharacter.status === "alive";
  const canManage = (canAdminWorld || isNationManager) && !isArchived;

  const queryClient = useQueryClient();
  const culturesQuery = useQuery(culturesByWorldQueryOptions(nation.worldId));
  const religionsQuery = useQuery(religionsByWorldQueryOptions(nation.worldId));
  const cultureReligionMutation = useMutation(
    setNationCultureReligionMutationOptions({ queryClient }),
  );

  const culture =
    culturesQuery.data?.find((c) => c.id === nation.primaryCultureId) ?? null;
  const religion =
    religionsQuery.data?.find((r) => r.id === nation.stateReligionId) ?? null;

  function handleCultureChange(primaryCultureId: string | null): void {
    if (primaryCultureId === nation.primaryCultureId) return;
    cultureReligionMutation.mutate(
      {
        nationId: nation.id,
        primaryCultureId,
        stateReligionId: nation.stateReligionId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to update primary culture.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Primary culture updated.");
        },
      },
    );
  }

  function handleReligionChange(stateReligionId: string | null): void {
    if (stateReligionId === nation.stateReligionId) return;
    cultureReligionMutation.mutate(
      {
        nationId: nation.id,
        primaryCultureId: nation.primaryCultureId,
        stateReligionId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to update state religion.");
        },
        onSuccess: () => {
          notifyMutationSuccess("State religion updated.");
        },
      },
    );
  }

  return (
    <Card
      aria-labelledby="nation-culture-religion-heading"
      className="grid gap-3 p-4"
    >
      <div className="flex items-center gap-2">
        <Landmark aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2
          id="nation-culture-religion-heading"
          className="text-base font-medium"
        >
          Culture & Religion
        </h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {canManage ? (
          <Label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Primary culture</span>
            <NativeSelect
              aria-label="Primary culture"
              disabled={cultureReligionMutation.isPending}
              value={nation.primaryCultureId ?? ""}
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
        ) : (
          <div className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Primary culture</span>
            {culture === null ? (
              <span className="text-sm italic text-muted-foreground">None</span>
            ) : (
              <CultureReligionChip color={culture.color} name={culture.name} />
            )}
          </div>
        )}

        {canManage ? (
          <Label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">State religion</span>
            <NativeSelect
              aria-label="State religion"
              disabled={cultureReligionMutation.isPending}
              value={nation.stateReligionId ?? ""}
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
        ) : (
          <div className="grid gap-1 text-sm">
            <span className="text-muted-foreground">State religion</span>
            {religion === null ? (
              <span className="text-sm italic text-muted-foreground">None</span>
            ) : (
              <CultureReligionChip
                color={religion.color}
                name={religion.name}
              />
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

function CultureReligionChip({
  color,
  name,
}: {
  readonly color: string;
  readonly name: string;
}): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      {name}
    </span>
  );
}
