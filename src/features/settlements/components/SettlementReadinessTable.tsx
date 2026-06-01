import { useMutation, useQueryClient } from "@tanstack/react-query";

import type { WorldPermissionContext } from "@/features/worlds";
import { notifyMutationError } from "@/lib/notify";

import {
  setSettlementAutoReadyMutationOptions,
  setSettlementReadinessMutationOptions,
} from "../mutations/settlementReadinessMutations";

import { SettlementReadinessRow } from "./SettlementReadinessRow";

import type { SettlementReadinessListItem } from "../types/settlementReadinessTypes";
import type { JSX } from "react";

type SettlementReadinessTableProps = {
  readonly accessContext: WorldPermissionContext;
  readonly canAdmin: boolean;
  readonly canManage: boolean;
  readonly isArchived: boolean;
  readonly items: readonly SettlementReadinessListItem[];
  readonly worldId: string;
};

export function SettlementReadinessTable({
  accessContext,
  canAdmin,
  canManage,
  isArchived,
  items,
  worldId,
}: SettlementReadinessTableProps): JSX.Element {
  const queryClient = useQueryClient();
  const setReadinessMutation = useMutation(
    setSettlementReadinessMutationOptions({
      accessContext,
      queryClient,
    }),
  );
  const setAutoReadyMutation = useMutation(
    setSettlementAutoReadyMutationOptions({
      accessContext,
      queryClient,
    }),
  );

  return (
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
            <th scope="col" className="px-4 py-2 font-medium">
              Last ready
            </th>
            <th scope="col" className="py-2 pl-4 font-medium">
              Manual readiness
            </th>
            {canAdmin ? (
              <th scope="col" className="py-2 pl-4 font-medium">
                Auto-ready
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map((item) => (
            <SettlementReadinessRow
              canSetAutoReady={canAdmin}
              canSetManualReady={canManage}
              isArchived={isArchived}
              item={item}
              key={item.id}
              worldId={worldId}
              pendingAutoReadySettlementId={
                setAutoReadyMutation.isPending
                  ? setAutoReadyMutation.variables.settlementId
                  : null
              }
              pendingSettlementId={
                setReadinessMutation.isPending
                  ? setReadinessMutation.variables.settlementId
                  : null
              }
              setAutoReady={(autoReadyEnabled) => {
                setAutoReadyMutation.mutate(
                  {
                    autoReadyEnabled,
                    settlementId: item.id,
                    worldId,
                  },
                  {
                    onError: (error) => {
                      notifyMutationError(error);
                    },
                  },
                );
              }}
              setReadiness={(isReady) => {
                setReadinessMutation.mutate(
                  {
                    isReady,
                    settlementId: item.id,
                    worldId,
                  },
                  {
                    onError: (error) => {
                      notifyMutationError(error);
                    },
                  },
                );
              }}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
