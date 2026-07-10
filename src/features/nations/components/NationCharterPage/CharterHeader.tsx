import { useQuery } from "@tanstack/react-query";
import { type JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { worldCalendarConfigQueryOptions } from "@/features/calendar";

import { nationSettlementsQueryOptions } from "../../queries/nationsQueries";
import { formatNationGovernmentType } from "../../types/nationTypes";
import { formatFoundedTurn } from "../NationDetailPage/IdentitySection";
import { NationFlagAvatar } from "../NationFlagAvatar";

import type { Nation } from "../../types/nationTypes";

export function CharterHeader({
  nation,
}: {
  readonly nation: Nation;
}): JSX.Element {
  const settlementsQuery = useQuery(nationSettlementsQueryOptions(nation.id));
  const calendarConfigQuery = useQuery(
    worldCalendarConfigQueryOptions(nation.worldId),
  );
  const capital =
    settlementsQuery.data?.find(
      (settlement) => settlement.id === nation.capitalSettlementId,
    ) ?? null;

  return (
    <header className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center">
      <NationFlagAvatar
        className="w-20 shrink-0"
        flagPath={nation.flagPath}
        nationId={nation.id}
      />
      <div className="min-w-0 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            {nation.name}
          </h1>
          <Badge variant="secondary">
            {formatNationGovernmentType(nation.governmentType)}
          </Badge>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <div className="flex gap-1">
            <dt className="font-medium text-foreground">Capital:</dt>
            <dd>{capital?.name ?? "Not set"}</dd>
          </div>
          <div className="flex gap-1">
            <dt className="font-medium text-foreground">Founded:</dt>
            <dd>
              {formatFoundedTurn(
                nation.foundedTurnNumber,
                calendarConfigQuery.data ?? null,
              )}
            </dd>
          </div>
        </dl>
      </div>
    </header>
  );
}
