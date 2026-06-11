import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { type JSX } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import {
  assignCitizenRoleMutationOptions,
  managerScopeLabel,
  playerCharactersInNationQueryOptions,
  revokeCitizenRoleMutationOptions,
  type Citizen,
} from "@/features/citizens";
import type { Nation } from "@/features/nations";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationSuccess } from "@/lib/notify";

import {
  getRoleMutationErrorDescription,
  invalidatePermissionsContext,
} from "./Utils";

import { type RoleAssignmentControlsProps } from "./index";

type NationVariantProps = Extract<
  RoleAssignmentControlsProps,
  { variant: "nation" }
>;

export function NationRoleAssignmentControls({
  canAdminWorld,
  isArchived,
  isNationManager,
  nation,
}: NationVariantProps): JSX.Element | null {
  if (!canAdminWorld && !isNationManager) {
    return null;
  }

  return <NationRoleAssignmentList isArchived={isArchived} nation={nation} />;
}

function NationRoleAssignmentList({
  isArchived,
  nation,
}: {
  readonly isArchived: boolean;
  readonly nation: Nation;
}): JSX.Element {
  const playerCharactersQuery = useQuery(
    playerCharactersInNationQueryOptions(nation.id),
  );

  if (playerCharactersQuery.isPending) {
    return <LoadingState label="Loading player characters…" />;
  }

  if (playerCharactersQuery.isError) {
    return (
      <ErrorState
        title="Player characters could not be loaded"
        description={getErrorDescription(playerCharactersQuery.error)}
      />
    );
  }

  const candidates = playerCharactersQuery.data.filter(
    (citizen) => managerScopeLabel(citizen.roleType) !== "nation",
  );

  if (candidates.length === 0) {
    return (
      <EmptyState
        title="No assignable player characters"
        description="This nation has no player characters available to assign as Settlement Manager."
      />
    );
  }

  return (
    <ul className="grid gap-2" aria-label="Player characters">
      {candidates.map((citizen) => (
        <NationRoleAssignmentRow
          key={citizen.id}
          citizen={citizen}
          isArchived={isArchived}
        />
      ))}
    </ul>
  );
}

function NationRoleAssignmentRow({
  citizen,
  isArchived,
}: {
  readonly citizen: Citizen;
  readonly isArchived: boolean;
}): JSX.Element {
  const queryClient = useQueryClient();
  const assignMutation = useMutation(
    assignCitizenRoleMutationOptions({ queryClient }),
  );
  const revokeMutation = useMutation(
    revokeCitizenRoleMutationOptions({ queryClient }),
  );

  const settlementId = citizen.settlementId;
  const isPending = assignMutation.isPending || revokeMutation.isPending;
  const isSettlementManager =
    managerScopeLabel(citizen.roleType) === "settlement";

  function handleAssign(): void {
    if (settlementId === null) {
      return;
    }
    assignMutation.reset();
    revokeMutation.reset();
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
        },
      },
    );
  }

  function handleRevoke(): void {
    revokeMutation.reset();
    assignMutation.reset();
    revokeMutation.mutate(
      { citizenId: citizen.id, worldId: citizen.worldId },
      {
        onError: (error) => {
          toast.error(getRoleMutationErrorDescription(error));
        },
        onSuccess: () => {
          invalidatePermissionsContext(queryClient);
          notifyMutationSuccess(`Role removed from ${citizen.name}.`);
        },
      },
    );
  }

  return (
    <li className="grid gap-2 rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="grid gap-0.5 text-sm">
          <span className="font-medium">{citizen.name}</span>
          <span className="text-xs text-muted-foreground">
            {isSettlementManager ? "Settlement manager" : "No role"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {isSettlementManager ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending || isArchived}
              onClick={handleRevoke}
            >
              {revokeMutation.isPending ? "Revoking…" : "Revoke role"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending || isArchived || settlementId === null}
              onClick={handleAssign}
            >
              {assignMutation.isPending
                ? "Assigning…"
                : "Assign Settlement Manager"}
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}
