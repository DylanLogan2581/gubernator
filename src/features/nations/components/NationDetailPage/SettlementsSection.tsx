import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { useState, type JSX } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CitizenAvatar,
  managerScopeLabel,
  playerCharactersInNationQueryOptions,
  type Citizen,
} from "@/features/citizens";
import { useSettlementManageAuthority } from "@/features/permissions";
import {
  ManualReadinessControl,
  ReadOnlyReadinessIndicator,
  CreateSettlementDialog,
  deleteSettlementMutationOptions,
  setSettlementReadinessMutationOptions,
} from "@/features/settlements";
import type { WorldPermissionContext } from "@/features/worlds";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { nationSettlementsQueryOptions } from "../../queries/nationsQueries";
import { nationsQueryKeys } from "../../queries/nationsQueryKeys";

import type { NationSettlement } from "../../types/nationTypes";

function findSettlementManager(
  citizens: readonly Citizen[],
  settlementId: string,
): Citizen | null {
  return (
    citizens.find(
      (citizen) =>
        managerScopeLabel(citizen.roleType) === "settlement" &&
        citizen.roleSettlementId === settlementId,
    ) ?? null
  );
}

export function NationSettlementsSection({
  accessContext,
  canAdmin = false,
  isArchived = false,
  nationId,
  worldId,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly canAdmin?: boolean;
  readonly isArchived?: boolean;
  readonly nationId: string;
  readonly worldId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const settlementsQuery = useQuery(nationSettlementsQueryOptions(nationId));
  const playerCharactersQuery = useQuery(
    playerCharactersInNationQueryOptions(nationId),
  );
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  const managers = playerCharactersQuery.data ?? [];

  return (
    <section
      aria-labelledby="nation-settlements-heading"
      className="grid gap-3 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="nation-settlements-heading" className="text-base font-medium">
          Settlements
        </h2>
        {canAdmin && (
          <Button
            size="sm"
            onClick={() => {
              setShowCreateDialog(true);
            }}
          >
            <Plus aria-hidden="true" className="size-4" />
            New settlement
          </Button>
        )}
      </div>
      {settlementsQuery.isPending ? (
        <LoadingState label="Loading settlements…" />
      ) : settlementsQuery.isError ? (
        <ErrorState
          title="Settlements could not be loaded"
          description={getErrorDescription(settlementsQuery.error)}
        />
      ) : settlementsQuery.data.length === 0 ? (
        <EmptyState
          title="No settlements"
          description="This nation has no settlements yet."
        />
      ) : (
        <ul className="grid gap-2" aria-label="Settlements">
          {settlementsQuery.data.map((settlement) => (
            <NationSettlementListItem
              key={settlement.id}
              accessContext={accessContext}
              canAdmin={canAdmin}
              isArchived={isArchived}
              manager={findSettlementManager(managers, settlement.id)}
              queryClient={queryClient}
              settlement={settlement}
              worldId={worldId}
            />
          ))}
        </ul>
      )}

      {showCreateDialog && (
        <CreateSettlementDialog
          nationId={nationId}
          worldId={worldId}
          queryClient={queryClient}
          onClose={() => {
            setShowCreateDialog(false);
          }}
        />
      )}
    </section>
  );
}

function NationSettlementListItem({
  accessContext,
  canAdmin,
  isArchived,
  manager,
  queryClient,
  settlement,
  worldId,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly manager: Citizen | null;
  readonly queryClient: QueryClient;
  readonly settlement: NationSettlement;
  readonly worldId: string;
}): JSX.Element {
  const [isPending, setIsPending] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const { canManageSettlement } = useSettlementManageAuthority({
    canAdmin,
    nationId: settlement.nationId,
    settlementId: settlement.id,
  });

  const readinessMutation = useMutation(
    setSettlementReadinessMutationOptions({ accessContext, queryClient }),
  );
  const deleteMutation = useMutation(
    deleteSettlementMutationOptions({ queryClient }),
  );

  const handleSetReadiness = (isReady: boolean): void => {
    setIsPending(true);
    readinessMutation.mutate(
      {
        isReady,
        settlementId: settlement.id,
        worldId,
      },
      {
        onSuccess: () => {
          void queryClient.invalidateQueries({
            queryKey: nationsQueryKeys.settlements(settlement.nationId),
          });
        },
        onError: (error) => {
          notifyMutationError(error);
        },
        onSettled: () => {
          setIsPending(false);
        },
      },
    );
  };

  function handleConfirmDelete(): void {
    deleteMutation.reset();
    deleteMutation.mutate(
      {
        nationId: settlement.nationId,
        settlementId: settlement.id,
        worldId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to delete settlement.");
        },
        onSuccess: () => {
          setIsConfirmingDelete(false);
          notifyMutationSuccess("Settlement deleted.");
        },
      },
    );
  }

  const canDelete = canAdmin && !isArchived;

  return (
    <li className="rounded-md border border-border bg-background p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            to="/worlds/$worldId/nations/$nationId/settlements/$settlementId"
            params={{
              nationId: settlement.nationId,
              settlementId: settlement.id,
              worldId,
            }}
            search={{}}
            className="text-sm font-medium underline-offset-4 hover:underline text-left"
          >
            {settlement.name}
          </Link>
          <span className="text-xs text-muted-foreground">
            Population: {settlement.population.toLocaleString()}
          </span>
          {manager === null ? (
            <span className="text-xs text-muted-foreground">Unassigned</span>
          ) : (
            <Link
              to="/worlds/$worldId/citizens/$citizenId"
              params={{ citizenId: manager.id, worldId }}
              search={{}}
              className="flex items-center gap-1.5 text-xs text-muted-foreground underline-offset-4 hover:underline"
            >
              <CitizenAvatar
                id={manager.id}
                name={manager.name}
                profilePhotoUrl={manager.profilePhotoUrl}
                size="sm"
              />
              {manager.name}
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          {canManageSettlement ? (
            <ManualReadinessControl
              isArchived={isArchived}
              item={settlement}
              isPending={isPending}
              setReadiness={handleSetReadiness}
            />
          ) : (
            <ReadOnlyReadinessIndicator item={settlement} />
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Actions for ${settlement.name}`}
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                variant="destructive"
                disabled={!canDelete}
                onSelect={() => {
                  setIsConfirmingDelete(true);
                }}
              >
                <Trash2 aria-hidden="true" />
                Delete settlement
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <ConfirmDialog
        open={isConfirmingDelete}
        onOpenChange={(open) => {
          if (!open) {
            setIsConfirmingDelete(false);
            deleteMutation.reset();
          }
        }}
        title="Delete settlement"
        description={
          <>
            Are you sure you want to delete{" "}
            <span className="font-medium">{settlement.name}</span>? This action
            cannot be undone.
          </>
        }
        confirmLabel={
          deleteMutation.isPending ? "Deleting…" : "Delete settlement"
        }
        isPending={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />
    </li>
  );
}
