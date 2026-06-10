import { type QueryClient } from "@tanstack/react-query";
import { useState, type JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { type TurnTransitionOutcome } from "@/features/turns";
import {
  parseBuildingAutoDeconstructedPayload,
  parseBuildingSuspendedPayload,
} from "@/shared/simulation";

import { tierEffectsToState } from "../../utils/tierEditorUtils";

import { DeconstructConfirmDialog } from "./DeconstructConfirmDialog";
import { HardDeleteSettlementBuildingDialog } from "./HardDeleteSettlementBuildingDialog";
import { RestoreSettlementBuildingDialog } from "./RestoreSettlementBuildingDialog";

import type {
  SettlementBuilding,
  SettlementBuildingState,
} from "../../types/settlementBuildingTypes";

function buildEffectsSummary(
  building: SettlementBuilding,
  resourceNames: ReadonlyMap<string, string>,
  jobNames: ReadonlyMap<string, string>,
): string {
  const rows = tierEffectsToState(building.effectsJson);
  const parts: string[] = [];
  for (const row of rows) {
    switch (row.effectType) {
      case "population_cap_increase":
        parts.push(`cap +${row.amount}`);
        break;
      case "job_capacity_increase":
        parts.push(
          `job +${row.amount} for ${jobNames.get(row.jobId) ?? row.jobId}`,
        );
        break;
      case "resource_storage_increase":
        parts.push(
          `storage +${row.amount} for ${resourceNames.get(row.resourceId) ?? row.resourceId}`,
        );
        break;
      case "passive_resource_production":
        parts.push(
          `passive +${row.amount}/turn of ${resourceNames.get(row.resourceId) ?? row.resourceId}`,
        );
        break;
      case "":
        break;
      default: {
        const _exhaustive: never = row.effectType;
        throw new Error(`Unknown effect type: ${String(_exhaustive)}`);
      }
    }
  }
  return parts.length > 0 ? parts.join(", ") : "—";
}

type StateBadgeVariant =
  | "default"
  | "secondary"
  | "outline"
  | "destructive"
  | "warning";

function stateBadgeVariant(state: SettlementBuildingState): StateBadgeVariant {
  switch (state) {
    case "active":
      return "default";
    case "suspended":
      return "warning";
    case "manually_deconstructed":
      return "secondary";
    case "auto_deconstructed":
      return "destructive";
  }
}

function stateBadgeLabel(state: SettlementBuildingState): string {
  switch (state) {
    case "active":
      return "active";
    case "suspended":
      return "Suspended";
    case "manually_deconstructed":
      return "deconstructed";
    case "auto_deconstructed":
      return "Auto-deconstructed";
  }
}

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
  readonly jobNames: ReadonlyMap<string, string>;
  readonly latestOutcome: TurnTransitionOutcome | null;
  readonly queryClient: QueryClient;
  readonly resourceNames: ReadonlyMap<string, string>;
  readonly settlementId: string;
  readonly worldId: string;
};

export function BuildingRow({
  building,
  canAdmin,
  canDeconstruct,
  jobNames,
  latestOutcome,
  queryClient,
  resourceNames,
  settlementId,
  worldId,
}: BuildingRowProps): JSX.Element {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [trashActionOpen, setTrashActionOpen] = useState<
    "restore" | "hard-delete" | null
  >(null);
  const effectsSummary = buildEffectsSummary(building, resourceNames, jobNames);
  const showDeconstructButton = canDeconstruct && building.state === "active";
  const isDeconstructed =
    building.state === "auto_deconstructed" ||
    building.state === "manually_deconstructed";
  const stateTooltip = buildStateBadgeTooltip(building, latestOutcome);

  return (
    <>
      <TableRow className="border-b border-border last:border-0">
        <TableCell className="py-2 pr-4">
          {building.name ?? building.blueprintName}
        </TableCell>
        <TableCell className="py-2 pr-4">Tier {building.tierNumber}</TableCell>
        <TableCell className="py-2 pr-4 text-muted-foreground">
          {effectsSummary}
        </TableCell>
        <TableCell className="w-16 py-2 pr-2">
          <Badge
            aria-label={`State: ${stateBadgeLabel(building.state)}`}
            title={stateTooltip}
            variant={stateBadgeVariant(building.state)}
          >
            {stateBadgeLabel(building.state)}
          </Badge>
        </TableCell>
        {canAdmin ? (
          <TableCell className="w-28 py-2 text-right">
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
            {isDeconstructed && canAdmin ? (
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
