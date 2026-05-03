import {
  formatCalendarDate,
  resolveTurnCalendarDate,
  worldCalendarConfigSchema,
} from "@/features/calendar";
import type { Tables } from "@/types/database";

import type {
  AccessibleWorld,
  WorldPermissionContext,
} from "../types/worldTypes";

const FALLBACK_IN_WORLD_DATE_LABEL = "Calendar unavailable";

type WorldRow = Pick<
  Tables<"worlds">,
  | "archived_at"
  | "created_at"
  | "current_turn_number"
  | "id"
  | "name"
  | "owner_id"
  | "status"
  | "updated_at"
  | "visibility"
> & {
  readonly calendar_config_json?: Tables<"worlds">["calendar_config_json"];
};

export function toAccessibleWorld(
  world: WorldRow,
  accessContext: WorldPermissionContext,
): AccessibleWorld {
  const accessTarget = {
    id: world.id,
    ownerId: world.owner_id,
    visibility: world.visibility,
  };
  const planningTurnNumber = resolvePlanningTurnNumber(
    world.current_turn_number,
  );
  const nextTurnNumber = resolveNextTurnNumber(world.current_turn_number);

  return {
    archivedAt: world.archived_at,
    canAccess: accessContext.canAccessWorld(accessTarget),
    canAdmin: accessContext.canAdminWorld(accessTarget),
    canManage: accessContext.canManageWorld(accessTarget),
    createdAt: world.created_at,
    currentTurnNumber: world.current_turn_number,
    id: world.id,
    inWorldDateLabel: resolveInWorldDateLabel(
      world.calendar_config_json,
      planningTurnNumber,
      "compact",
    ),
    fullInWorldDateLabel: resolveInWorldDateLabel(
      world.calendar_config_json,
      planningTurnNumber,
      "full",
    ),
    isArchived: world.status === "archived",
    isHidden: world.visibility !== "public",
    name: world.name,
    nextFullInWorldDateLabel: resolveInWorldDateLabel(
      world.calendar_config_json,
      nextTurnNumber,
      "full",
    ),
    nextInWorldDateLabel: resolveInWorldDateLabel(
      world.calendar_config_json,
      nextTurnNumber,
      "compact",
    ),
    nextTurnNumber,
    ownerId: world.owner_id,
    planningTurnNumber,
    slug: createWorldSlug(world.name, world.id),
    status: world.status,
    updatedAt: world.updated_at,
    visibility: world.visibility,
  };
}

export function createWorldSlug(name: string, id: string): string {
  const normalizedName = name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/(^-|-$)/g, "");
  const normalizedId = id.replaceAll("-", "").slice(0, 8);
  const slugBase = normalizedName === "" ? "world" : normalizedName;

  return `${slugBase}-${normalizedId}`;
}

function resolvePlanningTurnNumber(currentTurnNumber: number): number {
  if (!Number.isInteger(currentTurnNumber) || currentTurnNumber < 0) {
    return 1;
  }

  return Math.max(1, currentTurnNumber);
}

function resolveNextTurnNumber(currentTurnNumber: number): number {
  if (!Number.isInteger(currentTurnNumber) || currentTurnNumber < 0) {
    return 2;
  }

  return currentTurnNumber + 1;
}

function resolveInWorldDateLabel(
  calendarConfigJson: WorldRow["calendar_config_json"] | undefined,
  planningTurnNumber: number,
  displayVariant: "compact" | "full",
): string {
  const parseResult = worldCalendarConfigSchema.safeParse(calendarConfigJson);

  if (!parseResult.success) {
    return FALLBACK_IN_WORLD_DATE_LABEL;
  }

  const calendarConfig = parseResult.data;

  try {
    return formatCalendarDate(
      resolveTurnCalendarDate(calendarConfig, planningTurnNumber),
      {
        displayVariant,
        yearFormatTemplate: calendarConfig.yearFormatTemplate,
      },
    );
  } catch {
    return FALLBACK_IN_WORLD_DATE_LABEL;
  }
}
