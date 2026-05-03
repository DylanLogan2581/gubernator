import { useQuery } from "@tanstack/react-query";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";

import { settlementReadinessSummaryQueryOptions } from "../queries/settlementReadinessQueries";

import type { SettlementReadinessSummary } from "../types/settlementReadinessTypes";
import type { JSX } from "react";

type SettlementReadinessSummaryPanelProps = {
  readonly worldId: string;
};

export function SettlementReadinessSummaryPanel({
  worldId,
}: SettlementReadinessSummaryPanelProps): JSX.Element {
  const summaryQuery = useQuery(
    settlementReadinessSummaryQueryOptions(worldId),
  );

  if (summaryQuery.isPending) {
    return (
      <section
        aria-labelledby="settlement-readiness-title"
        className="rounded-md border border-border bg-card p-5 text-card-foreground"
      >
        <LoadingState label="Loading settlement readiness..." />
      </section>
    );
  }

  if (summaryQuery.isError) {
    return (
      <section
        aria-labelledby="settlement-readiness-title"
        className="rounded-md border border-border bg-card p-5 text-card-foreground"
      >
        <ErrorState
          title="Settlement readiness could not be loaded"
          description={getErrorDescription(summaryQuery.error)}
        />
      </section>
    );
  }

  return <SettlementReadinessSummaryPanelContent summary={summaryQuery.data} />;
}

export function SettlementReadinessSummaryPanelContent({
  summary,
}: {
  readonly summary: SettlementReadinessSummary;
}): JSX.Element {
  const hasSettlements = summary.totalSettlementCount > 0;

  return (
    <section
      aria-labelledby="settlement-readiness-title"
      className="grid gap-4 rounded-md border border-border bg-card p-5 text-card-foreground"
    >
      <div className="space-y-1">
        <h2
          id="settlement-readiness-title"
          className="text-lg font-semibold tracking-normal"
        >
          Settlement readiness
        </h2>
        <p className="text-sm text-muted-foreground">
          {hasSettlements
            ? "Auto-ready settlements count as ready for the current turn."
            : "No settlements exist in this world yet."}
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-3">
        <ReadinessMetric
          label="Total settlements"
          value={summary.totalSettlementCount}
        />
        <ReadinessMetric label="Ready" value={summary.readySettlementCount} />
        <ReadinessMetric
          label="Not ready"
          value={summary.notReadySettlementCount}
        />
      </dl>
    </section>
  );
}

function ReadinessMetric({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number;
}): JSX.Element {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold tracking-normal">{value}</dd>
    </div>
  );
}

function getErrorDescription(error: unknown): string {
  if (error instanceof Error && error.message !== "") {
    return error.message;
  }

  return "Try refreshing the page. If the problem continues, contact an administrator.";
}
