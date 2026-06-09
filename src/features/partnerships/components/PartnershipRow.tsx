import { useQuery } from "@tanstack/react-query";
import { Heart, HeartCrack, Pencil } from "lucide-react";
import { type JSX } from "react";

import { Button } from "@/components/ui/button";
import type { Citizen } from "@/features/citizens";
import { citizenByIdQueryOptions } from "@/features/citizens";

import { EndPartnershipForm } from "./EndPartnershipForm";
import { ReassignPartnerForm } from "./ReassignPartnerForm";
import {
  PartnerLink,
  PartnershipStatusChip,
} from "./shared/PartnershipFormFields";

import type { Partnership } from "../types/partnershipTypes";

type RowAction = "dissolve" | "widow" | "reassign";

export function PartnershipRow({
  canAdmin,
  currentTurnNumber,
  focalCitizen,
  onCloseAction,
  onOpenAction,
  openAction,
  partnership,
  rowAdminReady,
  turnTransitionId,
}: {
  readonly canAdmin: boolean;
  readonly currentTurnNumber: number | null;
  readonly focalCitizen: Citizen;
  readonly onCloseAction: () => void;
  readonly onOpenAction: (kind: RowAction) => void;
  readonly openAction: RowAction | null;
  readonly partnership: Partnership;
  readonly rowAdminReady: boolean;
  readonly turnTransitionId: string | null;
}): JSX.Element {
  const partnerId =
    partnership.citizenAId === focalCitizen.id
      ? partnership.citizenBId
      : partnership.citizenAId;
  const partnerQuery = useQuery(citizenByIdQueryOptions(partnerId));
  const partner = partnerQuery.data ?? null;
  const isCrossSettlement =
    partner !== null && partner.settlementId !== focalCitizen.settlementId;

  return (
    <li className="grid gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">Partner:</span>
          <PartnerLink
            partner={partner}
            partnerId={partnerId}
            queryError={partnerQuery.isError}
            queryPending={partnerQuery.isPending}
            worldId={focalCitizen.worldId}
          />
          {isCrossSettlement ? (
            <span
              className="inline-flex items-center rounded-sm bg-amber-500/15 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300"
              title="Partner belongs to a different settlement."
            >
              Cross-settlement
            </span>
          ) : null}
          <PartnershipStatusChip status={partnership.status} />
        </div>
        {canAdmin && partnership.status === "active" ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!rowAdminReady}
              onClick={() => onOpenAction("dissolve")}
            >
              <HeartCrack aria-hidden="true" />
              Dissolve
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!rowAdminReady}
              onClick={() => onOpenAction("widow")}
            >
              <Heart aria-hidden="true" />
              Mark widowed
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!rowAdminReady}
              onClick={() => onOpenAction("reassign")}
            >
              <Pencil aria-hidden="true" />
              Reassign
            </Button>
          </div>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        Formed on turn {partnership.formedOnTurnNumber}
        {partnership.endedOnTurnNumber === null
          ? ""
          : ` · Ended on turn ${partnership.endedOnTurnNumber}`}
      </p>
      {partnership.changeReason === null ? null : (
        <p className="text-xs italic text-muted-foreground">
          "{partnership.changeReason}"
        </p>
      )}
      {openAction === "dissolve" &&
      rowAdminReady &&
      turnTransitionId !== null ? (
        <EndPartnershipForm
          defaultTurnNumber={
            currentTurnNumber ?? partnership.formedOnTurnNumber
          }
          kind="dissolve"
          onClose={onCloseAction}
          partnership={partnership}
          turnTransitionId={turnTransitionId}
        />
      ) : null}
      {openAction === "widow" && rowAdminReady && turnTransitionId !== null ? (
        <EndPartnershipForm
          defaultTurnNumber={
            currentTurnNumber ?? partnership.formedOnTurnNumber
          }
          kind="widow"
          onClose={onCloseAction}
          partnership={partnership}
          turnTransitionId={turnTransitionId}
        />
      ) : null}
      {openAction === "reassign" &&
      rowAdminReady &&
      turnTransitionId !== null &&
      currentTurnNumber !== null ? (
        <ReassignPartnerForm
          currentTurnNumber={currentTurnNumber}
          focalCitizen={focalCitizen}
          onClose={onCloseAction}
          partnership={partnership}
          retainedCitizenId={focalCitizen.id}
          turnTransitionId={turnTransitionId}
        />
      ) : null}
    </li>
  );
}
