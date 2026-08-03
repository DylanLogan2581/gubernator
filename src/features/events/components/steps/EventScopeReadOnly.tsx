import { useQuery } from "@tanstack/react-query";
import { type JSX } from "react";

import { Label } from "@/components/ui/label";
import { nationByIdQueryOptions } from "@/features/nations";
import { settlementByIdQueryOptions } from "@/features/settlements";

import { EventScopeBadge } from "../EventBadges";

import type { EventScopeType } from "../../types/eventTypes";

type EventScopeReadOnlyProps = {
  readonly scopeType: EventScopeType;
  readonly scopeNationId: string | null;
  readonly scopeSettlementId: string | null;
};

export function EventScopeReadOnly({
  scopeType,
  scopeNationId,
  scopeSettlementId,
}: EventScopeReadOnlyProps): JSX.Element {
  return (
    <div className="space-y-2">
      <div>
        <Label className="text-base font-semibold">Event Scope</Label>
        <p className="text-sm text-muted-foreground">
          Scope is set when an event is created and can't be changed here.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <EventScopeBadge scopeType={scopeType} />
        <ScopeTargetName
          scopeType={scopeType}
          scopeNationId={scopeNationId}
          scopeSettlementId={scopeSettlementId}
        />
      </div>
    </div>
  );
}

function ScopeTargetName({
  scopeType,
  scopeNationId,
  scopeSettlementId,
}: EventScopeReadOnlyProps): JSX.Element | null {
  if (scopeType === "world") {
    return <span className="text-sm">Entire world</span>;
  }

  if (scopeType === "nation" && scopeNationId !== null) {
    return <NationName nationId={scopeNationId} />;
  }

  if (scopeType === "settlement" && scopeSettlementId !== null) {
    return <SettlementName settlementId={scopeSettlementId} />;
  }

  return null;
}

function NationName({ nationId }: { readonly nationId: string }): JSX.Element {
  const query = useQuery(nationByIdQueryOptions(nationId));

  if (query.isPending) {
    return <span className="text-sm text-muted-foreground">Loading…</span>;
  }

  if (query.isError || query.data === null) {
    return <span className="text-sm">Unknown nation</span>;
  }

  return <span className="text-sm">{query.data.name}</span>;
}

function SettlementName({
  settlementId,
}: {
  readonly settlementId: string;
}): JSX.Element {
  const query = useQuery(settlementByIdQueryOptions(settlementId));

  if (query.isPending) {
    return <span className="text-sm text-muted-foreground">Loading…</span>;
  }

  if (query.isError || query.data === null) {
    return <span className="text-sm">Unknown settlement</span>;
  }

  return <span className="text-sm">{query.data.name}</span>;
}
