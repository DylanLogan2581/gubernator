import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type JSX } from "react";
import { toast } from "sonner";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  assignCitizenRoleMutationOptions,
  citizenByIdQueryOptions,
  CitizenPicker,
  managerScopeLabel,
  revokeCitizenRoleMutationOptions,
  settlementManagersInNationQueryOptions,
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
  const [selectedCitizenId, setSelectedCitizenId] = useState<string | null>(
    null,
  );

  const managersQuery = useQuery(
    settlementManagersInNationQueryOptions(nation.id),
  );
  const selectedCitizenQuery = useQuery({
    ...citizenByIdQueryOptions(selectedCitizenId ?? ""),
    enabled: selectedCitizenId !== null,
  });

  if (managersQuery.isPending) {
    return <LoadingState label="Loading settlement managers…" />;
  }

  if (managersQuery.isError) {
    return (
      <ErrorState
        title="Settlement managers could not be loaded"
        description={getErrorDescription(managersQuery.error)}
      />
    );
  }

  const managers = managersQuery.data;
  const selectedCitizen = selectedCitizenQuery.data ?? null;

  return (
    <div className="grid gap-3">
      {managers.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No settlement managers assigned yet.
        </p>
      ) : (
        <ul className="grid gap-2" aria-label="Settlement managers">
          {managers.map((citizen) => (
            <NationRoleAssignmentRow
              key={citizen.id}
              citizen={citizen}
              isArchived={isArchived}
            />
          ))}
        </ul>
      )}
      <div className="grid gap-2 rounded-md border border-border bg-background p-3">
        <span className="text-xs font-medium text-muted-foreground">
          Assign a settlement manager
        </span>
        <CitizenPicker
          citizenId={selectedCitizenId}
          nationId={nation.id}
          onChange={setSelectedCitizenId}
          statusFilter="alive"
          worldId={nation.worldId}
        />
        {selectedCitizen === null ? null : (
          <ul className="grid gap-2" aria-label="Selected citizen">
            <NationRoleAssignmentRow
              citizen={selectedCitizen}
              isArchived={isArchived}
              onAssigned={() => setSelectedCitizenId(null)}
            />
          </ul>
        )}
      </div>
    </div>
  );
}

function NationRoleAssignmentRow({
  citizen,
  isArchived,
  onAssigned,
}: {
  readonly citizen: Citizen;
  readonly isArchived: boolean;
  readonly onAssigned?: () => void;
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
  const isNationManager = managerScopeLabel(citizen.roleType) === "nation";

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
          onAssigned?.();
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
          <span className="flex items-center gap-2 font-medium">
            {citizen.name}
            <Badge
              variant={citizen.citizenType === "npc" ? "secondary" : "outline"}
            >
              {citizen.citizenType === "npc" ? "NPC" : "Player character"}
            </Badge>
          </span>
          <span className="text-xs text-muted-foreground">
            {isNationManager
              ? "Nation manager"
              : isSettlementManager
                ? "Settlement manager"
                : "No role"}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {isNationManager ? (
            <span className="text-xs text-muted-foreground">
              Already a Nation Manager
            </span>
          ) : isSettlementManager ? (
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
