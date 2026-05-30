import { Link } from "@tanstack/react-router";

import { formatSettlementReadyTimestamp } from "../utils/settlementReadyTimestampFormatting";

import { AutoReadyControl } from "./AutoReadyControl";
import { ManualReadinessControl } from "./ManualReadinessControl";
import {
  ReadOnlyReadinessIndicator,
  ReadinessStateBadge,
} from "./ReadinessStateBadge";

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
  return (
    <tr>
      <th scope="row" className="py-3 pr-4 font-medium text-foreground">
        <Link
          to="/worlds/$worldId/nations/$nationId/settlements/$settlementId"
          params={{
            nationId: item.nationId,
            settlementId: item.id,
            worldId,
          }}
          className="underline-offset-4 hover:underline"
        >
          {item.name}
        </Link>
      </th>
      <td className="px-4 py-3">
        <ReadinessStateBadge item={item} />
      </td>
      <td className="px-4 py-3 text-muted-foreground">
        {item.lastReadyAt === null ? (
          <span>Never</span>
        ) : (
          <time dateTime={item.lastReadyAt}>
            {formatSettlementReadyTimestamp(item.lastReadyAt)}
          </time>
        )}
      </td>
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
