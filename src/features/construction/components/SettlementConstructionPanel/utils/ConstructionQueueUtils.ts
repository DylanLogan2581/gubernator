import type {
  BuildingBlueprint,
  SettlementBuilding,
} from "@/features/buildings";
import type { TurnTransitionLogEntry } from "@/features/turns";
import { parseConstructionPausedPayload } from "@/shared/simulation";

import type {
  ConstructionProject,
  ConstructionProjectStatus,
} from "../../../types/constructionProjectTypes";

export type ProjectLogData = {
  readonly pauseReason: string | null;
  readonly workers: number;
};

export const CONSTRUCTION_LOG_CATEGORIES = new Set([
  "construction.completed",
  "construction.paused",
  "construction.progress",
]);

export const ACTIVE_STATUSES: readonly ConstructionProjectStatus[] = [
  "queued",
  "in_progress",
  "paused",
];

export function getProjectLogData(
  projectId: string,
  logEntries: readonly TurnTransitionLogEntry[],
): ProjectLogData | null {
  for (const entry of logEntries) {
    if (!CONSTRUCTION_LOG_CATEGORIES.has(entry.logCategory)) continue;
    const parsed = parseConstructionPausedPayload(entry.payloadJsonb);
    if (parsed === null || parsed.projectId !== projectId) continue;
    return {
      pauseReason:
        entry.logCategory === "construction.paused"
          ? "Insufficient resources"
          : null,
      workers: parsed.workers,
    };
  }
  return null;
}

export function statusBadgeVariant(
  status: ConstructionProjectStatus,
): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "in_progress":
      return "default";
    case "queued":
      return "outline";
    case "paused":
      return "secondary";
    case "complete":
      return "default";
    case "cancelled":
      return "destructive";
  }
}

export function statusBadgeLabel(status: ConstructionProjectStatus): string {
  switch (status) {
    case "in_progress":
      return "in progress";
    case "queued":
      return "queued";
    case "paused":
      return "paused";
    case "complete":
      return "complete";
    case "cancelled":
      return "cancelled";
  }
}

export function getCapOverflowError(
  blueprint: BuildingBlueprint | undefined,
  blueprintId: string,
  projects: readonly ConstructionProject[],
  buildings: readonly SettlementBuilding[],
): string | null {
  if (blueprintId === "" || blueprint === undefined) return null;
  const max = blueprint.maxInstancesPerSettlement;
  if (max === null) return null;

  const activeBuildings = buildings.filter(
    (b) => b.buildingBlueprintId === blueprintId && b.state === "active",
  ).length;
  const activeProjects = projects.filter(
    (p) =>
      p.buildingBlueprintId === blueprintId &&
      (ACTIVE_STATUSES as readonly string[]).includes(p.status),
  ).length;

  if (activeBuildings + activeProjects >= max) {
    return `This settlement already has ${activeBuildings + activeProjects} of ${max} allowed instance(s) of this blueprint.`;
  }
  return null;
}

export function buildPositions(
  items: readonly ConstructionProject[],
  movedId: string,
  direction: "up" | "down",
): Array<{ projectId: string; position: number }> {
  const itemsCopy = [...items];
  const idx = itemsCopy.findIndex((p) => p.id === movedId);
  if (idx === -1) return [];
  const swapIdx = direction === "up" ? idx - 1 : idx + 1;
  if (swapIdx < 0 || swapIdx >= itemsCopy.length) return [];
  [itemsCopy[idx], itemsCopy[swapIdx]] = [itemsCopy[swapIdx], itemsCopy[idx]];
  return itemsCopy.map((p, i) => ({ position: i + 1, projectId: p.id }));
}
