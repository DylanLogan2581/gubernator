import { Link } from "@tanstack/react-router";
import { Check, X } from "lucide-react";

import { deriveSettlementReadinessState } from "../utils/settlementReadinessState";

import { AutoReadyControl } from "./AutoReadyControl";
import { ManualReadinessControl } from "./ManualReadinessControl";
import { ReadOnlyReadinessIndicator } from "./ReadinessStateBadge";

import type { SettlementReadinessListItem } from "../types/settlementReadinessTypes";
import type { JSX } from "react";

type SettlementReadinessRowProps = {
  readonly canSetAutoReady: boolean;
  readonly canSetManualReady: boolean;
  readonly isArchived: boolean;
  readonly item: SettlementReadinessListItem;
  readonly pendingAutoReadySettlementId: string | null;
  readonly pendingSettlementId: string | null;
  readonly setAutoReady: (autoReadyEnabled: boolean) => void;
  readonly setReadiness: (isReady: boolean) => void;
  readonly worldId: string;
};

export function SettlementReadinessRow({
  canSetAutoReady,
  canSetManualReady,
  isArchived,
  item,
  pendingAutoReadySettlementId,
  pendingSettlementId,
  setAutoReady,
  setReadiness,
  worldId,
}: SettlementReadinessRowProps): JSX.Element {
  const state = deriveSettlementReadinessState(item);
  const isReady = state.isReadyForCurrentTurn;
  const bgColor = isReady
    ? "bg-green-50 dark:bg-green-950/30"
    : "bg-red-50 dark:bg-red-950/30";

  return (
    <tr className={bgColor}>
      <th scope="row" className="py-3 pr-4 font-medium text-foreground">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 shrink-0 flex items-center justify-center text-sm">
            {isReady ? (
              <Check className="w-4 h-4 text-green-600 dark:text-green-500" />
            ) : (
              <X className="w-4 h-4 text-red-600 dark:text-red-500" />
            )}
          </div>
          <Link
            to="/worlds/$worldId/nations/$nationId/settlements/$settlementId"
            params={{
              nationId: item.nationId,
              settlementId: item.id,
              worldId,
            }}
            search={{}}
            className="underline-offset-4 hover:underline"
          >
            {item.name}
          </Link>
        </div>
      </th>
      <td className="py-3 pl-4">
        {canSetManualReady ? (
          <ManualReadinessControl
            isArchived={isArchived}
            item={item}
            isPending={pendingSettlementId === item.id}
            setReadiness={setReadiness}
          />
        ) : (
          <ReadOnlyReadinessIndicator item={item} />
        )}
      </td>
      {canSetAutoReady ? (
        <td className="py-3 pl-4">
          <AutoReadyControl
            isArchived={isArchived}
            isPending={pendingAutoReadySettlementId === item.id}
            item={item}
            setAutoReady={setAutoReady}
          />
        </td>
      ) : null}
    </tr>
  );
}
