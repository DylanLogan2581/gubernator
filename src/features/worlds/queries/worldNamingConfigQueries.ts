import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import {
  worldNamingConfigSchema,
  type WorldNamingConfig,
} from "../schemas/worldNamingConfigSchemas";

import { worldQueryKeys } from "./worldQueryKeys";

type WorldNamingConfigQueryKey = ReturnType<typeof worldQueryKeys.namingConfig>;
type WorldNamingConfigQueryOptions = UseQueryOptions<
  WorldNamingConfig,
  AuthUiError | WorldNamingConfigError,
  WorldNamingConfig,
  WorldNamingConfigQueryKey
>;
type WorldNamingConfigErrorCode =
  | "world_naming_config_invalid"
  | "world_naming_config_missing";

const WORLD_NAMING_CONFIG_SELECT = "naming_config_json";

export class WorldNamingConfigError extends Error {
  readonly code: WorldNamingConfigErrorCode;
  readonly worldId: string;

  constructor({
    code,
    message,
    worldId,
  }: {
    readonly code: WorldNamingConfigErrorCode;
    readonly message: string;
    readonly worldId: string;
  }) {
    super(message);
    this.name = "WorldNamingConfigError";
    this.code = code;
    this.worldId = worldId;
  }
}

export function worldNamingConfigQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): WorldNamingConfigQueryOptions {
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getWorldNamingConfig(client, worldId),
    queryKey: worldQueryKeys.namingConfig(worldId),
    retry: shouldRetryWorldNamingConfigQuery,
  });
}

export function shouldRetryWorldNamingConfigQuery(
  failureCount: number,
  error: Error,
): boolean {
  return failureCount < 3 && !isWorldNamingConfigError(error);
}

export function isWorldNamingConfigError(
  error: unknown,
): error is WorldNamingConfigError {
  return error instanceof WorldNamingConfigError;
}

async function getWorldNamingConfig(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<WorldNamingConfig> {
  const { data, error } = await client
    .from("worlds")
    .select(WORLD_NAMING_CONFIG_SELECT)
    .eq("id", worldId)
    .maybeSingle();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  if (data === null || data.naming_config_json === null) {
    throw new WorldNamingConfigError({
      code: "world_naming_config_missing",
      message: "Naming configuration is unavailable.",
      worldId,
    });
  }

  const parseResult = worldNamingConfigSchema.safeParse(
    data.naming_config_json,
  );

  if (!parseResult.success) {
    throw new WorldNamingConfigError({
      code: "world_naming_config_invalid",
      message: "Naming configuration is invalid.",
      worldId,
    });
  }

  return parseResult.data;
}
