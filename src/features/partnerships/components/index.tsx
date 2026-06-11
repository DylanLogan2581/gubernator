import { useQuery } from "@tanstack/react-query";
import { UserPlus } from "lucide-react";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import type { Citizen } from "@/features/citizens";
import {
  currentTurnStateQueryOptions,
  latestTurnTransitionStatusQueryOptions,
} from "@/features/turns";
import { getErrorDescription } from "@/lib/errorUtils";

import { partnershipsForCitizenQueryOptions } from "../queries/partnershipsQueries";
import { getAdminUnavailableReason } from "../utils/partnershipErrors";

import { CreatePartnershipForm } from "./CreatePartnershipForm";
import { PartnershipRow } from "./PartnershipRow";

type PartnershipHistoryPanelProps = {
  readonly canAdmin: boolean;
  readonly citizen: Citizen;
  readonly isArchived?: boolean;
};

export function PartnershipHistoryPanel({
  canAdmin,
  citizen,
  isArchived = false,
}: PartnershipHistoryPanelProps): JSX.Element {
  const partnershipsQuery = useQuery(
    partnershipsForCitizenQueryOptions(citizen.id),
  );
  const latestTransitionQuery = useQuery({
    ...latestTurnTransitionStatusQueryOptions(citizen.worldId),
    enabled: canAdmin,
  });
  const currentTurnQuery = useQuery({
    ...currentTurnStateQueryOptions(citizen.worldId),
    enabled: canAdmin,
  });

  const turnTransitionId = latestTransitionQuery.data?.id ?? null;
  const currentTurnNumber = currentTurnQuery.data?.currentTurnNumber ?? null;
  const adminReady =
    canAdmin &&
    !isArchived &&
    turnTransitionId !== null &&
    currentTurnNumber !== null;

  const adminUnavailableReason = canAdmin
    ? getAdminUnavailableReason({
        currentTurnQuery,
        isArchived,
        latestTransitionQuery,
      })
    : null;

  const partnerships = partnershipsQuery.data ?? [];
  const hasActive = partnerships.some(
    (partnership) => partnership.status === "active",
  );

  const [openAction, setOpenAction] = useState<{
    readonly id: string;
    readonly kind: "dissolve" | "widow" | "reassign";
  } | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  return (
    <section
      aria-labelledby="citizen-partnerships-heading"
      className="grid gap-3 p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <h2
            id="citizen-partnerships-heading"
            className="text-base font-medium"
          >
            Partnership history
          </h2>
          <p className="text-sm text-muted-foreground">
            Active and past partnerships for this citizen.
          </p>
        </div>
        {canAdmin && !hasActive && !isCreating ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!adminReady}
            title={adminUnavailableReason ?? undefined}
            onClick={() => setIsCreating(true)}
          >
            <UserPlus aria-hidden="true" />
            Create partnership
          </Button>
        ) : null}
      </div>

      {canAdmin && adminUnavailableReason !== null ? (
        <p className="rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
          {adminUnavailableReason}
        </p>
      ) : null}

      {canAdmin && isCreating && adminReady ? (
        <CreatePartnershipForm
          focalCitizen={citizen}
          formedOnTurnNumber={currentTurnNumber}
          onClose={() => setIsCreating(false)}
          turnTransitionId={turnTransitionId}
        />
      ) : null}

      {partnershipsQuery.isPending ? (
        <LoadingState label="Loading partnerships…" />
      ) : partnershipsQuery.isError ? (
        <ErrorState
          title="Partnerships could not be loaded"
          description={getErrorDescription(partnershipsQuery.error)}
        />
      ) : partnerships.length === 0 ? (
        <EmptyState
          title="No partnerships"
          description="This citizen has no partnership records yet."
        />
      ) : (
        <ul aria-label="Partnerships" className="grid gap-2">
          {partnerships.map((partnership) => {
            const isThisRowActive = partnership.status === "active";
            const rowAdminReady = adminReady && isThisRowActive;
            const openKind =
              openAction?.id === partnership.id ? openAction.kind : null;
            return (
              <PartnershipRow
                key={partnership.id}
                canAdmin={canAdmin}
                currentTurnNumber={currentTurnNumber}
                focalCitizen={citizen}
                onCloseAction={() => setOpenAction(null)}
                onOpenAction={(kind) =>
                  setOpenAction({ id: partnership.id, kind })
                }
                openAction={openKind}
                partnership={partnership}
                rowAdminReady={rowAdminReady}
                turnTransitionId={turnTransitionId}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}
