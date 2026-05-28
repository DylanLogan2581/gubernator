import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import type { WorldPermissionContext } from "@/features/worlds";
import { getErrorDescription } from "@/lib/errorUtils";

import { settlementReadinessListQueryOptions } from "../queries/settlementReadinessQueries";

import { SettlementReadinessTable } from "./SettlementReadinessTable";

import type { SettlementReadinessListItem } from "../types/settlementReadinessTypes";
import type { JSX, ReactNode } from "react";

type SettlementReadinessListPanelProps = {
  readonly accessContext: WorldPermissionContext;
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function SettlementReadinessListPanel({
  accessContext,
  canAdmin,
  canManage,
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
      canManage={canManage}
      isArchived={isArchived}
      items={readinessListQuery.data}
      worldId={worldId}
    />
  );
}

export function SettlementReadinessListPanelContent({
  accessContext,
  canAdmin,
  canManage,
  isArchived,
  items,
  worldId,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly isArchived: boolean;
  readonly items: readonly SettlementReadinessListItem[];
  readonly worldId: string;
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
      <SettlementReadinessTable
        accessContext={accessContext}
        canAdmin={canAdmin}
        canManage={canManage}
        isArchived={isArchived}
        items={items}
        worldId={worldId}
      />
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
