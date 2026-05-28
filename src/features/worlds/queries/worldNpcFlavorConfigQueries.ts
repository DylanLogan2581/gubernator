import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import {
  worldNpcFlavorConfigSchema,
  type WorldNpcFlavorConfig,
} from "../schemas/worldNpcFlavorConfigSchemas";

import { worldQueryKeys } from "./worldQueryKeys";

type WorldNpcFlavorConfigQueryKey = ReturnType<
  typeof worldQueryKeys.npcFlavorConfig
>;
type WorldNpcFlavorConfigQueryOptions = UseQueryOptions<
  WorldNpcFlavorConfig,
  AuthUiError | WorldNpcFlavorConfigError,
  WorldNpcFlavorConfig,
  WorldNpcFlavorConfigQueryKey
>;
type WorldNpcFlavorConfigErrorCode =
  | "world_npc_flavor_config_invalid"
  | "world_npc_flavor_config_missing";

const WORLD_NPC_FLAVOR_CONFIG_SELECT = "npc_flavor_config_json";

export class WorldNpcFlavorConfigError extends Error {
  readonly code: WorldNpcFlavorConfigErrorCode;
  readonly worldId: string;

  constructor({
    code,
    message,
    worldId,
  }: {
    readonly code: WorldNpcFlavorConfigErrorCode;
    readonly message: string;
    readonly worldId: string;
  }) {
    super(message);
    this.name = "WorldNpcFlavorConfigError";
    this.code = code;
    this.worldId = worldId;
  }
}

export function worldNpcFlavorConfigQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): WorldNpcFlavorConfigQueryOptions {
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getWorldNpcFlavorConfig(client, worldId),
    queryKey: worldQueryKeys.npcFlavorConfig(worldId),
    retry: shouldRetryWorldNpcFlavorConfigQuery,
  });
}

export function shouldRetryWorldNpcFlavorConfigQuery(
  failureCount: number,
  error: Error,
): boolean {
  return failureCount < 3 && !isWorldNpcFlavorConfigError(error);
}

export function isWorldNpcFlavorConfigError(
  error: unknown,
): error is WorldNpcFlavorConfigError {
  return error instanceof WorldNpcFlavorConfigError;
}

async function getWorldNpcFlavorConfig(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<WorldNpcFlavorConfig> {
  const { data, error } = await client
    .from("worlds")
    .select(WORLD_NPC_FLAVOR_CONFIG_SELECT)
    .eq("id", worldId)
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null || data.npc_flavor_config_json === null) {
    throw new WorldNpcFlavorConfigError({
      code: "world_npc_flavor_config_missing",
      message: "NPC flavor configuration is unavailable.",
      worldId,
    });
  }

  const parseResult = worldNpcFlavorConfigSchema.safeParse(
    data.npc_flavor_config_json,
  );

  if (!parseResult.success) {
    throw new WorldNpcFlavorConfigError({
      code: "world_npc_flavor_config_invalid",
      message: "NPC flavor configuration is invalid.",
      worldId,
    });
  }

  return parseResult.data;
}
