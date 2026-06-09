import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import type { WorldPermissionContext } from "@/features/worlds";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError } from "@/lib/notify";

import {
  setSettlementAutoReadyMutationOptions,
  setSettlementReadinessMutationOptions,
} from "../../mutations/settlementReadinessMutations";
import { settlementReadinessListQueryOptions } from "../../queries/settlementReadinessQueries";
import { AutoReadyControl } from "../AutoReadyControl";
import { ManualReadinessControl } from "../ManualReadinessControl";

import type { SettlementReadinessListItem } from "../../types/settlementReadinessTypes";
import type { JSX } from "react";

export function SettlementReadinessSection({
  accessContext,
  canAdmin,
  canManage,
  isArchived,
  settlementId,
  worldId,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly isArchived: boolean;
  readonly settlementId: string;
  readonly worldId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const readinessQuery = useQuery(settlementReadinessListQueryOptions(worldId));
  const setReadinessMutation = useMutation(
    setSettlementReadinessMutationOptions({ accessContext, queryClient }),
  );
  const setAutoReadyMutation = useMutation(
    setSettlementAutoReadyMutationOptions({ accessContext, queryClient }),
  );

  return (
    <section
      aria-labelledby="settlement-readiness-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <h2 id="settlement-readiness-heading" className="text-base font-medium">
        Readiness
      </h2>
      {readinessQuery.isPending ? (
        <LoadingState label="Loading readiness…" />
      ) : readinessQuery.isError ? (
        <ErrorState
          title="Readiness could not be loaded"
          description={getErrorDescription(readinessQuery.error)}
        />
      ) : (
        <SettlementReadinessSectionContent
          canSetAutoReady={canAdmin}
          canSetManualReady={canManage}
          isArchived={isArchived}
          isAutoReadyPending={
            setAutoReadyMutation.isPending &&
            setAutoReadyMutation.variables.settlementId === settlementId
          }
          isReadinessPending={
            setReadinessMutation.isPending &&
            setReadinessMutation.variables.settlementId === settlementId
          }
          item={
            readinessQuery.data.find((entry) => entry.id === settlementId) ??
            null
          }
          setAutoReady={(autoReadyEnabled) => {
            setAutoReadyMutation.mutate(
              {
                autoReadyEnabled,
                settlementId,
                worldId,
              },
              {
                onError: (error) => {
                  notifyMutationError(error);
                },
              },
            );
          }}
          setReadiness={(isReady) => {
            setReadinessMutation.mutate(
              {
                isReady,
                settlementId,
                worldId,
              },
              {
                onError: (error) => {
                  notifyMutationError(error);
                },
              },
            );
          }}
        />
      )}
    </section>
  );
}

function SettlementReadinessSectionContent({
  canSetAutoReady,
  canSetManualReady,
  isArchived,
  isAutoReadyPending,
  isReadinessPending,
  item,
  setAutoReady,
  setReadiness,
}: {
  readonly canSetAutoReady: boolean;
  readonly canSetManualReady: boolean;
  readonly isArchived: boolean;
  readonly isAutoReadyPending: boolean;
  readonly isReadinessPending: boolean;
  readonly item: SettlementReadinessListItem | null;
  readonly setAutoReady: (autoReadyEnabled: boolean) => void;
  readonly setReadiness: (isReady: boolean) => void;
}): JSX.Element {
  if (item === null) {
    return (
      <EmptyState
        title="Readiness unavailable"
        description="Readiness data for this settlement could not be found."
      />
    );
  }

  return (
    <div className="grid gap-3">
      {canSetManualReady ? (
        <ManualReadinessControl
          isArchived={isArchived}
          isPending={isReadinessPending}
          item={item}
          setReadiness={setReadiness}
        />
      ) : null}
      {canSetAutoReady ? (
        <AutoReadyControl
          isArchived={isArchived}
          isPending={isAutoReadyPending}
          item={item}
          setAutoReady={setAutoReady}
        />
      ) : null}
    </div>
  );
}
