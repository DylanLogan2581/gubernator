import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  createAccessContext,
  useSettlementManageAuthority,
} from "@/features/permissions";
import {
  setSettlementReadinessMutationOptions,
  settlementReadinessListQueryOptions,
} from "@/features/settlements";
import { notifyMutationError } from "@/lib/notify";

import type { JSX } from "react";

type HeaderReadinessChipProps = {
  readonly canAdmin: boolean;
  readonly nationId: string;
  readonly settlementId: string;
  readonly worldId: string;
};

// set_settlement_readiness authorizes server-side via the RPC itself, so the
// client-supplied access context is inert here (unlike set_settlement_auto_ready,
// which gates on accessContext.canAdminWorld) — a static placeholder is safe.
const READINESS_MUTATION_ACCESS_CONTEXT = createAccessContext({
  isSuperAdmin: false,
  userId: null,
  worldAdminWorldIds: [],
});

// Player equivalent of the admin-only End Turn button (design doc §3.3):
// settlement/nation managers mark their pinned settlement ready instead.
// Falls back to settlement routes only, since the pinned-settlement concept
// doesn't exist yet (#980 notes).
export function HeaderReadinessChip({
  canAdmin,
  nationId,
  settlementId,
  worldId,
}: HeaderReadinessChipProps): JSX.Element | null {
  const queryClient = useQueryClient();
  const { canManageSettlement } = useSettlementManageAuthority({
    canAdmin,
    nationId,
    settlementId,
  });
  const readinessQuery = useQuery(settlementReadinessListQueryOptions(worldId));
  const setReadinessMutation = useMutation(
    setSettlementReadinessMutationOptions({
      accessContext: READINESS_MUTATION_ACCESS_CONTEXT,
      queryClient,
    }),
  );

  // Admins see readiness progress on the End Turn button instead (design doc §3.3).
  if (canAdmin || !canManageSettlement) {
    return null;
  }

  const item =
    readinessQuery.data?.find((entry) => entry.id === settlementId) ?? null;

  if (item === null) {
    return null;
  }

  const isReady = item.isReadyForCurrentTurn;
  const isDisabled = item.autoReadyEnabled || setReadinessMutation.isPending;

  return (
    <Button
      type="button"
      variant={isReady ? "outline" : "default"}
      size="sm"
      disabled={isDisabled}
      onClick={() => {
        setReadinessMutation.mutate(
          { isReady: !isReady, settlementId, worldId },
          {
            onError: (error) => {
              notifyMutationError(error);
            },
          },
        );
      }}
    >
      {isReady ? "Ready ✓" : "Mark ready"}
    </Button>
  );
}
