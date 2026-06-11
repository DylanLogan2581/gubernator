import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
      <Table className="w-full min-w-120 text-sm">
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Settlement</TableHead>
            <TableHead scope="col">Manual readiness</TableHead>
            {canAdmin ? <TableHead scope="col">Auto-ready</TableHead> : null}
          </TableRow>
        </TableHeader>
        <TableBody>
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
        </TableBody>
      </Table>
    </div>
  );
}
