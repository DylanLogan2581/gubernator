import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeAuthError, type AuthUiError } from "@/features/auth";
import { turnQueryKeys } from "@/features/turns";
import type { WorldPermissionContext } from "@/features/worlds";
import { worldQueryKeys } from "@/features/worlds";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { calendarQueryKeys } from "../queries/calendarQueryKeys";
import {
  worldCalendarConfigSchema,
  type WorldCalendarConfig,
} from "../schemas/calendarConfigSchemas";

type SaveWorldCalendarConfigErrorCode =
  | "world_calendar_config_archived"
  | "world_calendar_config_invalid"
  | "world_calendar_config_unauthorized";
type SaveWorldCalendarConfigMutationOptions = UseMutationOptions<
  WorldCalendarConfig,
  AuthUiError | SaveWorldCalendarConfigError,
  SaveWorldCalendarConfigInput
>;
type WorldCalendarSaveAccessRow = {
  readonly archived_at: string | null;
  readonly id: string;
  readonly owner_id: string;
  readonly status: string;
  readonly visibility: string;
};

export type SaveWorldCalendarConfigInput = {
  readonly config: unknown;
  readonly worldId: string;
};

const WORLD_CALENDAR_SAVE_ACCESS_SELECT =
  "archived_at,id,owner_id,status,visibility";
const WORLD_CALENDAR_SAVE_UPDATE_SELECT = "id";

export class SaveWorldCalendarConfigError extends Error {
  readonly code: SaveWorldCalendarConfigErrorCode;
  readonly worldId: string;

  constructor({
    code,
    message,
    worldId,
  }: {
    readonly code: SaveWorldCalendarConfigErrorCode;
    readonly message: string;
    readonly worldId: string;
  }) {
    super(message);
    this.name = "SaveWorldCalendarConfigError";
    this.code = code;
    this.worldId = worldId;
  }
}

export function saveWorldCalendarConfigMutationOptions({
  accessContext,
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SaveWorldCalendarConfigMutationOptions {
  return mutationOptions({
    mutationFn: (input: SaveWorldCalendarConfigInput) =>
      saveWorldCalendarConfig(client, accessContext, input),
    mutationKey: [...calendarQueryKeys.all, "save-world-calendar-config"],
    onSuccess: async (_result, input): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: calendarQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: worldQueryKeys.all }),
        queryClient.invalidateQueries({
          queryKey: turnQueryKeys.currentTurnState(input.worldId),
        }),
      ]);
    },
  });
}

export function isSaveWorldCalendarConfigError(
  error: unknown,
): error is SaveWorldCalendarConfigError {
  return error instanceof SaveWorldCalendarConfigError;
}

async function saveWorldCalendarConfig(
  client: GubernatorSupabaseClient,
  accessContext: WorldPermissionContext,
  input: SaveWorldCalendarConfigInput,
): Promise<WorldCalendarConfig> {
  const parseResult = worldCalendarConfigSchema.safeParse(input.config);

  if (!parseResult.success) {
    throw new SaveWorldCalendarConfigError({
      code: "world_calendar_config_invalid",
      message: "Calendar configuration is invalid.",
      worldId: input.worldId,
    });
  }

  const world = await getCalendarSaveAccessRow(client, input.worldId);

  if (
    world === null ||
    !accessContext.canAdminWorld(toWorldAccessTarget(world))
  ) {
    throw new SaveWorldCalendarConfigError({
      code: "world_calendar_config_unauthorized",
      message: "You do not have permission to update this calendar.",
      worldId: input.worldId,
    });
  }

  if (world.status === "archived" || world.archived_at !== null) {
    throw new SaveWorldCalendarConfigError({
      code: "world_calendar_config_archived",
      message: "Archived worlds are read-only.",
      worldId: input.worldId,
    });
  }

  const { data, error } = await client
    .from("worlds")
    .update({ calendar_config_json: parseResult.data })
    .eq("id", input.worldId)
    .eq("status", "active")
    .select(WORLD_CALENDAR_SAVE_UPDATE_SELECT)
    .maybeSingle();

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  if (data === null) {
    throw new SaveWorldCalendarConfigError({
      code: "world_calendar_config_unauthorized",
      message: "Calendar configuration could not be saved.",
      worldId: input.worldId,
    });
  }

  return parseResult.data;
}

async function getCalendarSaveAccessRow(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<WorldCalendarSaveAccessRow | null> {
  const { data, error } = await client
    .from("worlds")
    .select(WORLD_CALENDAR_SAVE_ACCESS_SELECT)
    .eq("id", worldId)
    .maybeSingle();

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  return data;
}

function toWorldAccessTarget(world: WorldCalendarSaveAccessRow): {
  readonly id: string;
  readonly ownerId: string;
  readonly visibility: string;
} {
  return {
    id: world.id,
    ownerId: world.owner_id,
    visibility: world.visibility,
  };
}
