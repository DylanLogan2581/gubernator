import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Save, X } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  assignCitizenRoleMutationOptions,
  isPlayerRole,
  managerScopeLabel,
  revokeCitizenRoleMutationOptions,
  type Citizen,
} from "@/features/citizens";
import { settlementByIdQueryOptions } from "@/features/settlements";
import { notifyMutationSuccess } from "@/lib/notify";

import { ScopeDropdown } from "./ScopeDropdown";
import {
  citizenRoleLabel,
  getRoleMutationErrorDescription,
  invalidatePermissionsContext,
} from "./Utils";

import { type RoleSelection, type RoleAssignmentControlsProps } from "./index";

type CitizenVariantProps = Extract<
  RoleAssignmentControlsProps,
  { variant: "citizen" }
>;

export function CitizenRoleAssignmentControls({
  canAdminWorld,
  citizen,
  isArchived,
}: CitizenVariantProps): JSX.Element | null {
  if (!canAdminWorld) {
    return null;
  }
  if (citizen.citizenType !== "player_character") {
    return null;
  }

  return (
    <CitizenRoleAssignmentForm citizen={citizen} isArchived={isArchived} />
  );
}

function CitizenRoleAssignmentForm({
  citizen,
  isArchived,
}: {
  readonly citizen: Citizen;
  readonly isArchived: boolean;
}): JSX.Element {
  const queryClient = useQueryClient();
  const settlementId = citizen.settlementId;
  const settlementQuery = useQuery({
    ...settlementByIdQueryOptions(settlementId ?? ""),
    enabled: settlementId !== null,
  });
  const settlement = settlementQuery.data ?? null;
  const settlementNationId = settlement?.nationId ?? null;
  const settlementName = settlement?.name ?? null;
  const nationName = settlement?.nation.name ?? null;

  const [isEditing, setIsEditing] = useState(false);
  const [roleType, setRoleType] = useState<RoleSelection>(citizen.roleType);
  const [scopeError, setScopeError] = useState<string | undefined>(undefined);

  const assignMutation = useMutation(
    assignCitizenRoleMutationOptions({ queryClient }),
  );
  const revokeMutation = useMutation(
    revokeCitizenRoleMutationOptions({ queryClient }),
  );

  function closeEditor(): void {
    setIsEditing(false);
    setRoleType(citizen.roleType);
    setScopeError(undefined);
    assignMutation.reset();
    revokeMutation.reset();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setScopeError(undefined);
    assignMutation.reset();
    revokeMutation.reset();

    if (isPlayerRole(roleType)) {
      revokeMutation.mutate(
        { citizenId: citizen.id, worldId: citizen.worldId },
        {
          onError: (error) => {
            toast.error(getRoleMutationErrorDescription(error));
          },
          onSuccess: () => {
            invalidatePermissionsContext(queryClient);
            notifyMutationSuccess(`Role removed from ${citizen.name}.`);
            setIsEditing(false);
          },
        },
      );
      return;
    }

    if (settlementId === null) {
      setScopeError(
        "Citizen must belong to a settlement before a role can be assigned.",
      );
      return;
    }

    if (managerScopeLabel(roleType) === "nation") {
      if (settlementNationId === null) {
        setScopeError("Citizen's settlement is not attached to a nation.");
        return;
      }
      assignMutation.mutate(
        {
          citizenId: citizen.id,
          roleNationId: settlementNationId,
          roleType: "nation_manager",
          worldId: citizen.worldId,
        },
        {
          onError: (error) => {
            toast.error(getRoleMutationErrorDescription(error));
          },
          onSuccess: () => {
            invalidatePermissionsContext(queryClient);
            notifyMutationSuccess(
              `Assigned Nation Manager to ${citizen.name}.`,
            );
            setIsEditing(false);
          },
        },
      );
      return;
    }

    assignMutation.mutate(
      {
        citizenId: citizen.id,
        roleSettlementId: settlementId,
        roleType: "settlement_manager",
        worldId: citizen.worldId,
      },
      {
        onError: (error) => {
          toast.error(getRoleMutationErrorDescription(error));
        },
        onSuccess: () => {
          invalidatePermissionsContext(queryClient);
          notifyMutationSuccess(
            `Assigned Settlement Manager to ${citizen.name}.`,
          );
          setIsEditing(false);
        },
      },
    );
  }

  const canEdit = !isArchived;
  const isPending = assignMutation.isPending || revokeMutation.isPending;

  return (
    <div className="grid gap-2 rounded-md border border-border bg-background px-3 py-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid gap-0.5 text-sm">
          <span className="text-xs text-muted-foreground">Role</span>
          <span>{citizenRoleLabel(citizen, nationName, settlementName)}</span>
        </div>
        {canEdit && !isEditing ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            <Pencil aria-hidden="true" />
            Change role
          </Button>
        ) : null}
      </div>
      {isEditing ? (
        <form
          aria-label="Change citizen role"
          className="grid gap-2"
          noValidate
          onSubmit={handleSubmit}
        >
          <div className="grid gap-1 text-sm">
            <Label htmlFor="role-type">Role type</Label>
            <NativeSelect
              id="role-type"
              aria-label="Role type"
              className="bg-transparent px-2"
              disabled={isPending}
              value={roleType}
              onChange={(event) => {
                setRoleType(event.currentTarget.value as RoleSelection);
                setScopeError(undefined);
              }}
            >
              <option value="none">None</option>
              <option value="nation_manager">Nation manager</option>
              <option value="settlement_manager">Settlement manager</option>
            </NativeSelect>
          </div>
          {managerScopeLabel(roleType) === "nation" ? (
            <ScopeDropdown
              label="Nation"
              optionLabel={nationName ?? settlementNationId ?? ""}
              optionValue={settlementNationId ?? ""}
              isLoading={settlementQuery.isPending && settlementId !== null}
            />
          ) : null}
          {managerScopeLabel(roleType) === "settlement" ? (
            <ScopeDropdown
              label="Settlement"
              optionLabel={settlementName ?? settlementId ?? ""}
              optionValue={settlementId ?? ""}
              isLoading={settlementQuery.isPending && settlementId !== null}
            />
          ) : null}
          {scopeError === undefined ? null : (
            <p role="alert" className="text-sm text-destructive">
              {scopeError}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" disabled={isPending}>
              <Save aria-hidden="true" />
              {isPending ? "Saving…" : "Save role"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={closeEditor}
              disabled={isPending}
            >
              <X aria-hidden="true" />
              Cancel
            </Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
