import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import type { WorldPermissionContext } from "@/features/worlds";
import { cn } from "@/lib/utils";

import {
  setSettlementAutoReadyMutationOptions,
  setSettlementReadinessMutationOptions,
} from "../mutations/settlementReadinessMutations";
import { settlementReadinessListQueryOptions } from "../queries/settlementReadinessQueries";

import type { SettlementReadinessListItem } from "../types/settlementReadinessTypes";
import type { JSX, ReactNode } from "react";

type SettlementReadinessListPanelProps = {
  readonly accessContext: WorldPermissionContext;
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function SettlementReadinessListPanel({
  accessContext,
  canAdmin,
  isArchived,
  worldId,
}: SettlementReadinessListPanelProps): JSX.Element {
  const readinessListQuery = useQuery(
    settlementReadinessListQueryOptions(worldId),
  );

  if (readinessListQuery.isPending) {
    return (
      <SettlementReadinessListFrame>
        <LoadingState label="Loading settlement readiness list..." />
      </SettlementReadinessListFrame>
    );
  }

  if (readinessListQuery.isError) {
    return (
      <SettlementReadinessListFrame>
        <ErrorState
          title="Settlement readiness list could not be loaded"
          description={getErrorDescription(readinessListQuery.error)}
        />
      </SettlementReadinessListFrame>
    );
  }

  if (readinessListQuery.data.length === 0) {
    return (
      <SettlementReadinessListFrame>
        <EmptyState
          title="No settlements yet"
          description="Settlement readiness appears here after settlements are created."
        />
      </SettlementReadinessListFrame>
    );
  }

  return (
    <SettlementReadinessListPanelContent
      accessContext={accessContext}
      canAdmin={canAdmin}
      isArchived={isArchived}
      items={readinessListQuery.data}
      worldId={worldId}
    />
  );
}

export function SettlementReadinessListPanelContent({
  accessContext,
  canAdmin,
  isArchived,
  items,
  worldId,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly items: readonly SettlementReadinessListItem[];
  readonly worldId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const setReadinessMutation = useMutation(
    setSettlementReadinessMutationOptions({
      accessContext,
      queryClient,
    }),
  );
  const setAutoReadyMutation = useMutation(
    setSettlementAutoReadyMutationOptions({
      accessContext,
      queryClient,
    }),
  );

  return (
    <SettlementReadinessListFrame>
      <div className="space-y-1">
        <h2
          id="settlement-readiness-list-title"
          className="text-lg font-semibold tracking-normal"
        >
          Settlement readiness list
        </h2>
        <p className="text-sm text-muted-foreground">
          Current turn readiness by settlement.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-120 text-left text-sm">
          <thead className="border-b border-border text-xs text-muted-foreground">
            <tr>
              <th scope="col" className="py-2 pr-4 font-medium">
                Settlement
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                State
              </th>
              <th scope="col" className="px-4 py-2 font-medium">
                Last ready
              </th>
              <th scope="col" className="py-2 pl-4 font-medium">
                Manual readiness
              </th>
              {canAdmin ? (
                <th scope="col" className="py-2 pl-4 font-medium">
                  Auto-ready
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => (
              <SettlementReadinessRow
                autoReadyMutationError={
                  setAutoReadyMutation.variables?.settlementId === item.id
                    ? setAutoReadyMutation.error
                    : null
                }
                canSetAutoReady={canAdmin}
                isArchived={isArchived}
                item={item}
                key={item.id}
                mutationError={
                  setReadinessMutation.variables?.settlementId === item.id
                    ? setReadinessMutation.error
                    : null
                }
                pendingAutoReadySettlementId={
                  setAutoReadyMutation.isPending
                    ? setAutoReadyMutation.variables.settlementId
                    : null
                }
                pendingSettlementId={
                  setReadinessMutation.isPending
                    ? setReadinessMutation.variables.settlementId
                    : null
                }
                setAutoReady={(autoReadyEnabled) => {
                  setAutoReadyMutation.mutate({
                    autoReadyEnabled,
                    settlementId: item.id,
                    worldId,
                  });
                }}
                setReadiness={(isReady) => {
                  setReadinessMutation.mutate({
                    isReady,
                    settlementId: item.id,
                    worldId,
                  });
                }}
              />
            ))}
          </tbody>
        </table>
      </div>
    </SettlementReadinessListFrame>
  );
}

function SettlementReadinessListFrame({
  children,
}: {
  readonly children: ReactNode;
}): JSX.Element {
  return (
    <section
      aria-labelledby="settlement-readiness-list-title"
      className="grid gap-4 rounded-md border border-border bg-card p-5 text-card-foreground"
    >
      {children}
    </section>
  );
}

function SettlementReadinessRow({
  autoReadyMutationError,
  canSetAutoReady,
  isArchived,
  item,
  mutationError,
  pendingAutoReadySettlementId,
  pendingSettlementId,
  setAutoReady,
  setReadiness,
}: {
  readonly autoReadyMutationError: Error | null;
  readonly canSetAutoReady: boolean;
  readonly isArchived: boolean;
  readonly item: SettlementReadinessListItem;
  readonly mutationError: Error | null;
  readonly pendingAutoReadySettlementId: string | null;
  readonly pendingSettlementId: string | null;
  readonly setAutoReady: (autoReadyEnabled: boolean) => void;
  readonly setReadiness: (isReady: boolean) => void;
}): JSX.Element {
  return (
    <tr>
      <th scope="row" className="py-3 pr-4 font-medium text-foreground">
        {item.name}
      </th>
      <td className="px-4 py-3">
        <ReadinessStateBadge item={item} />
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {item.readySetAt === null ? (
          <span>Never</span>
        ) : (
          <time dateTime={item.readySetAt}>{item.readySetAt}</time>
        )}
      </td>
      <td className="py-3 pl-4">
        <ManualReadinessControl
          isArchived={isArchived}
          item={item}
          mutationError={mutationError}
          isPending={pendingSettlementId === item.id}
          setReadiness={setReadiness}
        />
      </td>
      {canSetAutoReady ? (
        <td className="py-3 pl-4">
          <AutoReadyControl
            isArchived={isArchived}
            isPending={pendingAutoReadySettlementId === item.id}
            item={item}
            mutationError={autoReadyMutationError}
            setAutoReady={setAutoReady}
          />
        </td>
      ) : null}
    </tr>
  );
}

function ReadinessStateBadge({
  item,
}: {
  readonly item: SettlementReadinessListItem;
}): JSX.Element {
  const label = getReadinessStateLabel(item);

  return (
    <span className="inline-flex w-fit rounded-sm border border-border bg-background px-2 py-1 text-xs font-medium text-foreground">
      {label}
    </span>
  );
}

function getReadinessStateLabel(item: SettlementReadinessListItem): string {
  if (item.autoReadyEnabled) {
    return "Auto-ready";
  }

  if (item.isReadyForCurrentTurn) {
    return "Ready";
  }

  return "Not ready";
}

function ManualReadinessControl({
  isArchived,
  isPending,
  item,
  mutationError,
  setReadiness,
}: {
  readonly isArchived: boolean;
  readonly isPending: boolean;
  readonly item: SettlementReadinessListItem;
  readonly mutationError: Error | null;
  readonly setReadiness: (isReady: boolean) => void;
}): JSX.Element {
  const descriptionId = `settlement-readiness-${item.id}-description`;
  const errorId = `settlement-readiness-${item.id}-error`;
  const isAutoReady = item.autoReadyEnabled;
  const isDisabled = isArchived || isAutoReady || isPending;
  const description = getManualReadinessDescription({
    isArchived,
    isAutoReady,
    isPending,
  });

  return (
    <div className="grid gap-2">
      <label className="inline-flex w-fit items-center gap-2 text-sm font-medium text-foreground">
        <input
          aria-describedby={
            mutationError === null
              ? descriptionId
              : `${descriptionId} ${errorId}`
          }
          aria-invalid={mutationError === null ? undefined : true}
          checked={item.isReadyCurrentTurn}
          className="peer sr-only"
          disabled={isDisabled}
          onChange={(event) => {
            setReadiness(event.currentTarget.checked);
          }}
          role="switch"
          type="checkbox"
        />
        <span
          aria-hidden="true"
          className={cn(
            "relative h-5 w-9 rounded-full border border-border bg-muted transition-colors peer-checked:bg-primary peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-disabled:opacity-50",
            "after:absolute after:top-0.5 after:left-0.5 after:size-3.5 after:rounded-full after:bg-background after:shadow-sm after:transition-transform peer-checked:after:translate-x-4",
          )}
        />
        <span>{item.isReadyCurrentTurn ? "Ready" : "Not ready"}</span>
      </label>
      <p id={descriptionId} className="max-w-64 text-xs text-muted-foreground">
        {description}
      </p>
      {mutationError === null ? null : (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {getErrorDescription(mutationError)}
        </p>
      )}
    </div>
  );
}

function AutoReadyControl({
  isArchived,
  isPending,
  item,
  mutationError,
  setAutoReady,
}: {
  readonly isArchived: boolean;
  readonly isPending: boolean;
  readonly item: SettlementReadinessListItem;
  readonly mutationError: Error | null;
  readonly setAutoReady: (autoReadyEnabled: boolean) => void;
}): JSX.Element {
  const descriptionId = `settlement-auto-ready-${item.id}-description`;
  const errorId = `settlement-auto-ready-${item.id}-error`;
  const isDisabled = isArchived || isPending;
  const description = getAutoReadyDescription({ isArchived, isPending });

  return (
    <div className="grid gap-2">
      <label className="inline-flex w-fit items-center gap-2 text-sm font-medium text-foreground">
        <input
          aria-describedby={
            mutationError === null
              ? descriptionId
              : `${descriptionId} ${errorId}`
          }
          aria-invalid={mutationError === null ? undefined : true}
          checked={item.autoReadyEnabled}
          className="peer sr-only"
          disabled={isDisabled}
          onChange={(event) => {
            setAutoReady(event.currentTarget.checked);
          }}
          role="switch"
          type="checkbox"
        />
        <span
          aria-hidden="true"
          className={cn(
            "relative h-5 w-9 rounded-full border border-border bg-muted transition-colors peer-checked:bg-primary peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 peer-disabled:opacity-50",
            "after:absolute after:top-0.5 after:left-0.5 after:size-3.5 after:rounded-full after:bg-background after:shadow-sm after:transition-transform peer-checked:after:translate-x-4",
          )}
        />
        <span>Auto-ready</span>
      </label>
      <p id={descriptionId} className="max-w-64 text-xs text-muted-foreground">
        {description}
      </p>
      {mutationError === null ? null : (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {getErrorDescription(mutationError)}
        </p>
      )}
    </div>
  );
}

function getManualReadinessDescription({
  isArchived,
  isAutoReady,
  isPending,
}: {
  readonly isArchived: boolean;
  readonly isAutoReady: boolean;
  readonly isPending: boolean;
}): string {
  if (isArchived) {
    return "Manual readiness is disabled because this world is archived.";
  }

  if (isAutoReady) {
    return "Auto-ready is enabled, so this settlement does not need manual readiness.";
  }

  if (isPending) {
    return "Saving manual readiness.";
  }

  return "Toggle whether this settlement is ready for the current turn.";
}

function getAutoReadyDescription({
  isArchived,
  isPending,
}: {
  readonly isArchived: boolean;
  readonly isPending: boolean;
}): string {
  if (isArchived) {
    return "Auto-ready is disabled because this world is archived.";
  }

  if (isPending) {
    return "Saving auto-ready.";
  }

  return "Automatically count this settlement as ready for each turn.";
}

function getErrorDescription(error: unknown): string {
  if (error instanceof Error && error.message !== "") {
    return error.message;
  }

  return "Try refreshing the page. If the problem continues, contact an administrator.";
}
