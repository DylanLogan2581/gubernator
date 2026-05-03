import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";

import { settlementReadinessListQueryOptions } from "../queries/settlementReadinessQueries";

import type { SettlementReadinessListItem } from "../types/settlementReadinessTypes";
import type { JSX, ReactNode } from "react";

type SettlementReadinessListPanelProps = {
  readonly worldId: string;
};

export function SettlementReadinessListPanel({
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
    <SettlementReadinessListPanelContent items={readinessListQuery.data} />
  );
}

export function SettlementReadinessListPanelContent({
  items,
}: {
  readonly items: readonly SettlementReadinessListItem[];
}): JSX.Element {
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
              <th scope="col" className="py-2 pl-4 font-medium">
                Last ready
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((item) => (
              <SettlementReadinessRow item={item} key={item.id} />
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
  item,
}: {
  readonly item: SettlementReadinessListItem;
}): JSX.Element {
  return (
    <tr>
      <th scope="row" className="py-3 pr-4 font-medium text-foreground">
        {item.name}
      </th>
      <td className="px-4 py-3">
        <ReadinessStateBadge item={item} />
      </td>
      <td className="py-3 pl-4 text-muted-foreground">
        {item.readySetAt === null ? (
          <span>Never</span>
        ) : (
          <time dateTime={item.readySetAt}>{item.readySetAt}</time>
        )}
      </td>
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

function getErrorDescription(error: unknown): string {
  if (error instanceof Error && error.message !== "") {
    return error.message;
  }

  return "Try refreshing the page. If the problem continues, contact an administrator.";
}
