import { useQuery } from "@tanstack/react-query";
import { type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";

import { partnershipsForCitizenQueryOptions } from "../queries/partnershipsQueries";

import type { Partnership, PartnershipStatus } from "../types/partnershipTypes";

type PartnershipHistoryPanelProps = {
  readonly citizenId: string;
};

export function PartnershipHistoryPanel({
  citizenId,
}: PartnershipHistoryPanelProps): JSX.Element {
  const partnershipsQuery = useQuery(
    partnershipsForCitizenQueryOptions(citizenId),
  );

  return (
    <section
      aria-labelledby="citizen-partnerships-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <div className="space-y-1">
        <h2 id="citizen-partnerships-heading" className="text-base font-medium">
          Partnership history
        </h2>
        <p className="text-sm text-muted-foreground">
          Active and past partnerships for this citizen.
        </p>
      </div>
      {partnershipsQuery.isPending ? (
        <LoadingState label="Loading partnerships…" />
      ) : partnershipsQuery.isError ? (
        <ErrorState
          title="Partnerships could not be loaded"
          description={getErrorDescription(partnershipsQuery.error)}
        />
      ) : partnershipsQuery.data.length === 0 ? (
        <EmptyState
          title="No partnerships"
          description="This citizen has no partnership records yet."
        />
      ) : (
        <ul aria-label="Partnerships" className="grid gap-2">
          {partnershipsQuery.data.map((partnership) => (
            <PartnershipRow
              key={partnership.id}
              citizenId={citizenId}
              partnership={partnership}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function PartnershipRow({
  citizenId,
  partnership,
}: {
  readonly citizenId: string;
  readonly partnership: Partnership;
}): JSX.Element {
  const partnerId =
    partnership.citizenAId === citizenId
      ? partnership.citizenBId
      : partnership.citizenAId;

  return (
    <li className="grid gap-1 rounded-md border border-border bg-background px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">
          Partner:{" "}
          <span className="font-mono text-xs text-muted-foreground">
            {partnerId}
          </span>
        </span>
        <PartnershipStatusChip status={partnership.status} />
      </div>
      <p className="text-xs text-muted-foreground">
        Formed on turn {partnership.formedOnTurnNumber}
        {partnership.endedOnTurnNumber === null
          ? ""
          : ` · Ended on turn ${partnership.endedOnTurnNumber}`}
      </p>
      {partnership.changeReason === null ? null : (
        <p className="text-xs italic text-muted-foreground">
          “{partnership.changeReason}”
        </p>
      )}
    </li>
  );
}

function PartnershipStatusChip({
  status,
}: {
  readonly status: PartnershipStatus;
}): JSX.Element {
  const tone =
    status === "active"
      ? "bg-secondary text-secondary-foreground"
      : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs ${tone}`}
    >
      {partnershipStatusLabel(status)}
    </span>
  );
}

function partnershipStatusLabel(status: PartnershipStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "dissolved":
      return "Dissolved";
    case "widowed":
      return "Widowed";
  }
}

function getErrorDescription(error: unknown): string {
  if (error instanceof Error && error.message !== "") {
    return error.message;
  }
  return "Try refreshing the page. If the problem continues, contact an administrator.";
}
