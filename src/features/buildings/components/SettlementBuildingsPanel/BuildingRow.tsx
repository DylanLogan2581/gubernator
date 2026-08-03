import { type QueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useState, type JSX } from "react";

import { IconChip } from "@/components/shared/IconChip";
import { resolveEntityIcon } from "@/components/shared/iconPicker/CuratedIcons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { UpgradeBuildingDialog } from "@/features/construction";
import { SchoolEducationSection } from "@/features/education";
import { type TurnTransitionOutcome } from "@/features/turns";
import { resolveIconTone } from "@/lib/categoricalPalette";
import {
  parseBuildingAutoDeconstructedPayload,
  parseBuildingSuspendedPayload,
} from "@/shared/simulation";

import {
  buildEffectChips,
  stateBadgeLabel,
  stateBadgeVariant,
} from "../../utils/buildingStateFormatting";

import { DeconstructConfirmDialog } from "./DeconstructConfirmDialog";
import { HardDeleteSettlementBuildingDialog } from "./HardDeleteSettlementBuildingDialog";
import { RestoreSettlementBuildingDialog } from "./RestoreSettlementBuildingDialog";

import type { SettlementBuilding } from "../../types/settlementBuildingTypes";

function buildStateBadgeTooltip(
  building: SettlementBuilding,
  latestOutcome: TurnTransitionOutcome | null,
): string | undefined {
  if (
    building.state !== "suspended" &&
    building.state !== "auto_deconstructed"
  ) {
    return undefined;
  }

  const logEntry = latestOutcome?.logEntries.find((e) => {
    if (e.logCategory === "building.auto_deconstructed") {
      return (
        parseBuildingAutoDeconstructedPayload(e.payloadJsonb)?.buildingId ===
        building.id
      );
    }
    if (e.logCategory === "building.suspended") {
      return (
        parseBuildingSuspendedPayload(e.payloadJsonb)?.buildingId ===
        building.id
      );
    }
    return false;
  });

  if (logEntry !== undefined && latestOutcome !== null) {
    const parts = [`Turn ${latestOutcome.toTurnNumber}`];
    if (logEntry.logCategory === "building.auto_deconstructed") {
      const payload = parseBuildingAutoDeconstructedPayload(
        logEntry.payloadJsonb,
      );
      if (payload !== null) {
        parts.push(`missed upkeep ${payload.missedUpkeepCount}×`);
        parts.push(`grace period: ${payload.gracePeriodTurns} turns`);
        return parts.join(" · ");
      }
    } else {
      const payload = parseBuildingSuspendedPayload(logEntry.payloadJsonb);
      if (payload !== null) {
        parts.push(`missed upkeep ${payload.missedUpkeepCount}×`);
        return parts.join(" · ");
      }
    }
  }

  return `Missed upkeep ${building.missedUpkeepCount}×`;
}

type BuildingRowProps = {
  readonly building: SettlementBuilding;
  readonly canDeconstruct: boolean;
  readonly canAdmin: boolean;
  readonly canManageSettlement: boolean;
  readonly isArchived: boolean;
  readonly jobNames: ReadonlyMap<string, string>;
  readonly latestOutcome: TurnTransitionOutcome | null;
  readonly queryClient: QueryClient;
  readonly resourceNames: ReadonlyMap<string, string>;
  readonly settlementId: string;
  readonly showTierColumn: boolean;
  readonly worldId: string;
};

export function BuildingRow({
  building,
  canAdmin,
  canDeconstruct,
  canManageSettlement,
  isArchived,
  jobNames,
  latestOutcome,
  queryClient,
  resourceNames,
  settlementId,
  showTierColumn,
  worldId,
}: BuildingRowProps): JSX.Element {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [trashActionOpen, setTrashActionOpen] = useState<
    "restore" | "hard-delete" | null
  >(null);
  const [educationOpen, setEducationOpen] = useState(false);
  const effectChips = buildEffectChips(building, resourceNames, jobNames);
  const showDeconstructButton = canDeconstruct && building.state === "active";
  const canUpgrade = canManageSettlement && !isArchived;
  const showUpgradeButton = canUpgrade && building.state === "active";
  const isDeconstructed =
    building.state === "auto_deconstructed" ||
    building.state === "manually_deconstructed";
  const stateTooltip = buildStateBadgeTooltip(building, latestOutcome);
  const showStateBadge = building.state !== "active";
  const isSchool = building.educationConfig !== null;
  const showActionsColumn = canAdmin || canUpgrade;
  const columnCount =
    3 + (showTierColumn ? 1 : 0) + (showActionsColumn ? 1 : 0);

  return (
    <>
      <TableRow className="border-b border-border last:border-0">
        <TableCell className="py-2 pr-4">
          <span className="flex items-center gap-2">
            {isSchool ? (
              <Button
                aria-expanded={educationOpen}
                aria-label={
                  educationOpen
                    ? "Hide education section"
                    : "Show education section"
                }
                className="h-6 w-6 shrink-0 p-0"
                size="icon-sm"
                type="button"
                variant="ghost"
                onClick={() => {
                  setEducationOpen((prev) => !prev);
                }}
              >
                <ChevronDown
                  aria-hidden="true"
                  className={educationOpen ? "h-4 w-4" : "h-4 w-4 -rotate-90"}
                />
              </Button>
            ) : (
              <span aria-hidden="true" className="h-6 w-6 shrink-0" />
            )}
            <IconChip
              icon={resolveEntityIcon(building.blueprintIcon)}
              tone={resolveIconTone(
                building.blueprintIconColor,
                building.buildingBlueprintId,
              )}
            />
            {building.name ?? building.blueprintName}
          </span>
        </TableCell>
        <TableCell className="w-12 py-2 pr-4">
          <Badge variant="secondary">1</Badge>
        </TableCell>
        {showTierColumn ? (
          <TableCell className="py-2 pr-4">
            Tier {building.tierNumber}
          </TableCell>
        ) : null}
        <TableCell className="py-2 pr-4">
          {effectChips.length > 0 ? (
            <span className="flex flex-wrap gap-1">
              {effectChips.map((chip) => (
                <Badge key={chip.key} variant="outline">
                  {chip.label}
                </Badge>
              ))}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="w-16 py-2 pr-2">
          {showStateBadge ? (
            <Badge
              aria-label={`State: ${stateBadgeLabel(building.state)}`}
              title={stateTooltip}
              variant={stateBadgeVariant(building.state)}
            >
              {stateBadgeLabel(building.state)}
            </Badge>
          ) : null}
        </TableCell>
        {showActionsColumn ? (
          <TableCell className="w-28 py-2 text-right">
            <div className="flex flex-wrap justify-end gap-1">
              {showUpgradeButton ? (
                <Button
                  aria-label={`Upgrade ${building.blueprintName}`}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setUpgradeOpen(true);
                  }}
                >
                  Upgrade
                </Button>
              ) : null}
              {showDeconstructButton ? (
                <Button
                  aria-label={`Deconstruct ${building.blueprintName}`}
                  size="sm"
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setConfirmOpen(true);
                  }}
                >
                  Deconstruct
                </Button>
              ) : null}
            </div>
            {isDeconstructed ? (
              <div className="flex gap-1 justify-end">
                <Button
                  aria-label={`Restore ${building.blueprintName}`}
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setTrashActionOpen("restore");
                  }}
                >
                  Restore
                </Button>
                <Button
                  aria-label={`Permanently delete ${building.blueprintName}`}
                  size="sm"
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    setTrashActionOpen("hard-delete");
                  }}
                >
                  Delete
                </Button>
              </div>
            ) : null}
          </TableCell>
        ) : null}
      </TableRow>
      {isSchool && educationOpen && building.educationConfig !== null ? (
        <TableRow className="border-b border-border last:border-0">
          <TableCell className="py-0 pr-4" colSpan={columnCount}>
            <SchoolEducationSection
              canManageSettlement={canManageSettlement}
              educationConfig={building.educationConfig}
              isArchived={isArchived}
              queryClient={queryClient}
              settlementBuildingId={building.id}
              settlementBuildingName={building.name ?? building.blueprintName}
              settlementId={settlementId}
              worldId={worldId}
            />
          </TableCell>
        </TableRow>
      ) : null}
      {upgradeOpen ? (
        <UpgradeBuildingDialog
          buildingBlueprintId={building.buildingBlueprintId}
          buildingName={building.name ?? building.blueprintName}
          currentTierNumber={building.tierNumber}
          queryClient={queryClient}
          settlementBuildingId={building.id}
          settlementId={settlementId}
          worldId={worldId}
          onClose={() => {
            setUpgradeOpen(false);
          }}
        />
      ) : null}
      {confirmOpen ? (
        <DeconstructConfirmDialog
          building={building}
          queryClient={queryClient}
          settlementId={settlementId}
          onClose={() => {
            setConfirmOpen(false);
          }}
        />
      ) : null}
      {trashActionOpen === "restore" ? (
        <RestoreSettlementBuildingDialog
          building={building}
          queryClient={queryClient}
          settlementId={settlementId}
          worldId={worldId}
          onClose={() => {
            setTrashActionOpen(null);
          }}
        />
      ) : null}
      {trashActionOpen === "hard-delete" ? (
        <HardDeleteSettlementBuildingDialog
          building={building}
          queryClient={queryClient}
          settlementId={settlementId}
          worldId={worldId}
          onClose={() => {
            setTrashActionOpen(null);
          }}
        />
      ) : null}
    </>
  );
}
