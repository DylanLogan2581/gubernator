import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import { toWorldAccessTarget } from "@/features/permissions";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import {
  worldNamingConfigSchema,
  type WorldNamingConfig,
} from "@/lib/worldNamingConfigSchemas";

import { worldQueryKeys } from "../queries/worldQueryKeys";

import type { WorldPermissionContext } from "../types/worldTypes";

type SaveWorldNamingConfigErrorCode =
  | "world_naming_config_archived"
  | "world_naming_config_invalid"
  | "world_naming_config_unauthorized";
type SaveWorldNamingConfigMutationOptions = UseMutationOptions<
  WorldNamingConfig,
  AuthUiError | SaveWorldNamingConfigError,
  SaveWorldNamingConfigInput
>;
type WorldNamingSaveAccessRow = {
  readonly archived_at: string | null;
  readonly id: string;
  readonly status: string;
  readonly visibility: string;
};

export type SaveWorldNamingConfigInput = {
  readonly config: unknown;
  readonly worldId: string;
};

const WORLD_NAMING_SAVE_ACCESS_SELECT = "archived_at,id,status,visibility";
const WORLD_NAMING_SAVE_UPDATE_SELECT = "id";

export class SaveWorldNamingConfigError extends Error {
  readonly code: SaveWorldNamingConfigErrorCode;
  readonly worldId: string;

  constructor({
    code,
    message,
    worldId,
  }: {
    readonly code: SaveWorldNamingConfigErrorCode;
    readonly message: string;
    readonly worldId: string;
  }) {
    super(message);
    this.name = "SaveWorldNamingConfigError";
    this.code = code;
    this.worldId = worldId;
  }
}

export function saveWorldNamingConfigMutationOptions({
  accessContext,
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SaveWorldNamingConfigMutationOptions {
  return mutationOptions({
    mutationFn: (input: SaveWorldNamingConfigInput) =>
      saveWorldNamingConfig(client, accessContext, input),
    mutationKey: [...worldQueryKeys.all, "save-world-naming-config"],
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: worldQueryKeys.all });
    },
  });
}

export function isSaveWorldNamingConfigError(
  error: unknown,
): error is SaveWorldNamingConfigError {
  return error instanceof SaveWorldNamingConfigError;
}

async function saveWorldNamingConfig(
  client: GubernatorSupabaseClient,
  accessContext: WorldPermissionContext,
  input: SaveWorldNamingConfigInput,
): Promise<WorldNamingConfig> {
  const parseResult = worldNamingConfigSchema.safeParse(input.config);

  if (!parseResult.success) {
    throw new SaveWorldNamingConfigError({
      code: "world_naming_config_invalid",
      message: "Naming configuration is invalid.",
      worldId: input.worldId,
    });
  }

  const world = await getNamingConfigSaveAccessRow(client, input.worldId);

  if (
    world === null ||
    !accessContext.canAdminWorld(toWorldAccessTarget(world))
  ) {
    throw new SaveWorldNamingConfigError({
      code: "world_naming_config_unauthorized",
      message: "You do not have permission to update naming configuration.",
      worldId: input.worldId,
    });
  }

  if (world.status === "archived" || world.archived_at !== null) {
    throw new SaveWorldNamingConfigError({
      code: "world_naming_config_archived",
      message: "Archived worlds are read-only.",
      worldId: input.worldId,
    });
  }

  const { data, error } = await client
    .from("worlds")
    .update({ naming_config_json: parseResult.data })
    .eq("id", input.worldId)
    .eq("status", "active")
    .select(WORLD_NAMING_SAVE_UPDATE_SELECT)
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null) {
    throw new SaveWorldNamingConfigError({
      code: "world_naming_config_unauthorized",
      message: "Naming configuration could not be saved.",
      worldId: input.worldId,
    });
  }

  return parseResult.data;
}

async function getNamingConfigSaveAccessRow(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<WorldNamingSaveAccessRow | null> {
  const { data, error } = await client
    .from("worlds")
    .select(WORLD_NAMING_SAVE_ACCESS_SELECT)
    .eq("id", worldId)
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data;
}
