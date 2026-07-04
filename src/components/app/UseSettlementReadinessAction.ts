import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  createAccessContext,
  useSettlementManageAuthority,
} from "@/features/permissions";
import {
  setSettlementReadinessMutationOptions,
  settlementReadinessListQueryOptions,
  type SettlementReadinessListItem,
} from "@/features/settlements";
import { notifyMutationError } from "@/lib/notify";

// set_settlement_readiness authorizes server-side via the RPC itself, so the
// client-supplied access context is inert here (unlike set_settlement_auto_ready,
// which gates on accessContext.canAdminWorld) — a static placeholder is safe.
const READINESS_MUTATION_ACCESS_CONTEXT = createAccessContext({
  isSuperAdmin: false,
  userId: null,
  worldAdminWorldIds: [],
});

type UseSettlementReadinessActionInput = {
  readonly canAdmin: boolean;
  readonly enabled: boolean;
  readonly nationId: string;
  readonly settlementId: string;
  readonly worldId: string;
};

type SettlementReadinessAction = {
  readonly isToggleDisabled: boolean;
  readonly isVisible: boolean;
  readonly item: SettlementReadinessListItem | null;
  readonly toggle: () => void;
};

// Shared by HeaderReadinessChip (always-visible header control) and the
// command palette's "Mark settlement ready" action — same permission
// gating and mutation, two entry points. Admins see readiness progress on
// the End Turn button instead (design doc §3.3), so this never surfaces
// for effective admins.
export function useSettlementReadinessAction({
  canAdmin,
  enabled,
  nationId,
  settlementId,
  worldId,
}: UseSettlementReadinessActionInput): SettlementReadinessAction {
  const queryClient = useQueryClient();
  const { canManageSettlement } = useSettlementManageAuthority({
    canAdmin,
    nationId,
    settlementId,
  });
  const readinessQuery = useQuery({
    ...settlementReadinessListQueryOptions(worldId),
    enabled: enabled && canManageSettlement && !canAdmin,
  });
  const setReadinessMutation = useMutation(
    setSettlementReadinessMutationOptions({
      accessContext: READINESS_MUTATION_ACCESS_CONTEXT,
      queryClient,
    }),
  );

  const item =
    readinessQuery.data?.find((entry) => entry.id === settlementId) ?? null;
  const isToggleDisabled =
    item === null || item.autoReadyEnabled || setReadinessMutation.isPending;

  return {
    isToggleDisabled,
    isVisible: !canAdmin && canManageSettlement && item !== null,
    item,
    toggle: () => {
      if (isToggleDisabled || item === null) {
        return;
      }
      setReadinessMutation.mutate(
        { isReady: !item.isReadyForCurrentTurn, settlementId, worldId },
        {
          onError: (error) => {
            notifyMutationError(error);
          },
        },
      );
    },
  };
}
