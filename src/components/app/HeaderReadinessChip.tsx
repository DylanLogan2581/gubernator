import { Button } from "@/components/ui/button";

import { useSettlementReadinessAction } from "./UseSettlementReadinessAction";

import type { JSX } from "react";

type HeaderReadinessChipProps = {
  readonly canAdmin: boolean;
  readonly nationId: string;
  readonly settlementId: string;
  readonly worldId: string;
};

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
  const { isToggleDisabled, isVisible, item, toggle } =
    useSettlementReadinessAction({
      canAdmin,
      enabled: true,
      nationId,
      settlementId,
      worldId,
    });

  if (!isVisible || item === null) {
    return null;
  }

  const isReady = item.isReadyForCurrentTurn;

  return (
    <Button
      type="button"
      variant={isReady ? "outline" : "default"}
      size="sm"
      disabled={isToggleDisabled}
      onClick={toggle}
    >
      {isReady ? "Ready ✓" : "Mark ready"}
    </Button>
  );
}
