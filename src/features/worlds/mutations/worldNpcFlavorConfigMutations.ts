import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeAuthError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { worldQueryKeys } from "../queries/worldQueryKeys";
import {
  worldNpcFlavorConfigSchema,
  type WorldNpcFlavorConfig,
} from "../schemas/worldNpcFlavorConfigSchemas";

import type { WorldPermissionContext } from "../types/worldTypes";

type SaveWorldNpcFlavorConfigErrorCode =
  | "world_npc_flavor_config_archived"
  | "world_npc_flavor_config_invalid"
  | "world_npc_flavor_config_unauthorized";
type SaveWorldNpcFlavorConfigMutationOptions = UseMutationOptions<
  WorldNpcFlavorConfig,
  AuthUiError | SaveWorldNpcFlavorConfigError,
  SaveWorldNpcFlavorConfigInput
>;
type WorldNpcFlavorSaveAccessRow = {
  readonly archived_at: string | null;
  readonly id: string;
  readonly owner_id: string;
  readonly status: string;
  readonly visibility: string;
};

export type SaveWorldNpcFlavorConfigInput = {
  readonly config: unknown;
  readonly worldId: string;
};

const WORLD_NPC_FLAVOR_SAVE_ACCESS_SELECT =
  "archived_at,id,owner_id,status,visibility";
const WORLD_NPC_FLAVOR_SAVE_UPDATE_SELECT = "id";

export class SaveWorldNpcFlavorConfigError extends Error {
  readonly code: SaveWorldNpcFlavorConfigErrorCode;
  readonly worldId: string;

  constructor({
    code,
    message,
    worldId,
  }: {
    readonly code: SaveWorldNpcFlavorConfigErrorCode;
    readonly message: string;
    readonly worldId: string;
  }) {
    super(message);
    this.name = "SaveWorldNpcFlavorConfigError";
    this.code = code;
    this.worldId = worldId;
  }
}

export function saveWorldNpcFlavorConfigMutationOptions({
  accessContext,
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly accessContext: WorldPermissionContext;
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): SaveWorldNpcFlavorConfigMutationOptions {
  return mutationOptions({
    mutationFn: (input: SaveWorldNpcFlavorConfigInput) =>
      saveWorldNpcFlavorConfig(client, accessContext, input),
    mutationKey: [...worldQueryKeys.all, "save-world-npc-flavor-config"],
    onSuccess: async (): Promise<void> => {
      await queryClient.invalidateQueries({ queryKey: worldQueryKeys.all });
    },
  });
}

export function isSaveWorldNpcFlavorConfigError(
  error: unknown,
): error is SaveWorldNpcFlavorConfigError {
  return error instanceof SaveWorldNpcFlavorConfigError;
}

async function saveWorldNpcFlavorConfig(
  client: GubernatorSupabaseClient,
  accessContext: WorldPermissionContext,
  input: SaveWorldNpcFlavorConfigInput,
): Promise<WorldNpcFlavorConfig> {
  const parseResult = worldNpcFlavorConfigSchema.safeParse(input.config);

  if (!parseResult.success) {
    throw new SaveWorldNpcFlavorConfigError({
      code: "world_npc_flavor_config_invalid",
      message: "NPC flavor configuration is invalid.",
      worldId: input.worldId,
    });
  }

  const world = await getNpcFlavorSaveAccessRow(client, input.worldId);

  if (
    world === null ||
    !accessContext.canAdminWorld(toWorldAccessTarget(world))
  ) {
    throw new SaveWorldNpcFlavorConfigError({
      code: "world_npc_flavor_config_unauthorized",
      message: "You do not have permission to update this NPC flavor config.",
      worldId: input.worldId,
    });
  }

  if (world.status === "archived" || world.archived_at !== null) {
    throw new SaveWorldNpcFlavorConfigError({
      code: "world_npc_flavor_config_archived",
      message: "Archived worlds are read-only.",
      worldId: input.worldId,
    });
  }

  const { data, error } = await client
    .from("worlds")
    .update({ npc_flavor_config_json: parseResult.data })
    .eq("id", input.worldId)
    .eq("status", "active")
    .select(WORLD_NPC_FLAVOR_SAVE_UPDATE_SELECT)
    .maybeSingle();

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  if (data === null) {
    throw new SaveWorldNpcFlavorConfigError({
      code: "world_npc_flavor_config_unauthorized",
      message: "NPC flavor configuration could not be saved.",
      worldId: input.worldId,
    });
  }

  return parseResult.data;
}

async function getNpcFlavorSaveAccessRow(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<WorldNpcFlavorSaveAccessRow | null> {
  const { data, error } = await client
    .from("worlds")
    .select(WORLD_NPC_FLAVOR_SAVE_ACCESS_SELECT)
    .eq("id", worldId)
    .maybeSingle();

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  return data;
}

function toWorldAccessTarget(world: WorldNpcFlavorSaveAccessRow): {
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
