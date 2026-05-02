import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeAuthError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import {
  worldCalendarConfigSchema,
  type WorldCalendarConfig,
} from "../schemas/calendarConfigSchemas";

import { calendarQueryKeys } from "./calendarQueryKeys";

type WorldCalendarConfigQueryKey = ReturnType<
  typeof calendarQueryKeys.worldCalendarConfig
>;
type WorldCalendarConfigQueryOptions = UseQueryOptions<
  WorldCalendarConfig,
  AuthUiError | WorldCalendarConfigError,
  WorldCalendarConfig,
  WorldCalendarConfigQueryKey
>;
type WorldCalendarConfigErrorCode =
  | "world_calendar_config_invalid"
  | "world_calendar_config_missing";

const WORLD_CALENDAR_CONFIG_SELECT = "calendar_config_json";

export class WorldCalendarConfigError extends Error {
  readonly code: WorldCalendarConfigErrorCode;
  readonly worldId: string;

  constructor({
    code,
    message,
    worldId,
  }: {
    readonly code: WorldCalendarConfigErrorCode;
    readonly message: string;
    readonly worldId: string;
  }) {
    super(message);
    this.name = "WorldCalendarConfigError";
    this.code = code;
    this.worldId = worldId;
  }
}

export function worldCalendarConfigQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): WorldCalendarConfigQueryOptions {
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getWorldCalendarConfig(client, worldId),
    queryKey: calendarQueryKeys.worldCalendarConfig(worldId),
    retry: shouldRetryWorldCalendarConfigQuery,
  });
}

export function shouldRetryWorldCalendarConfigQuery(
  failureCount: number,
  error: Error,
): boolean {
  return failureCount < 3 && !isWorldCalendarConfigError(error);
}

export function isWorldCalendarConfigError(
  error: unknown,
): error is WorldCalendarConfigError {
  return error instanceof WorldCalendarConfigError;
}

async function getWorldCalendarConfig(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<WorldCalendarConfig> {
  const { data, error } = await client
    .from("worlds")
    .select(WORLD_CALENDAR_CONFIG_SELECT)
    .eq("id", worldId)
    .maybeSingle();

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  if (data === null || data.calendar_config_json === null) {
    throw new WorldCalendarConfigError({
      code: "world_calendar_config_missing",
      message: "Calendar configuration is unavailable.",
      worldId,
    });
  }

  const parseResult = worldCalendarConfigSchema.safeParse(
    data.calendar_config_json,
  );

  if (!parseResult.success) {
    throw new WorldCalendarConfigError({
      code: "world_calendar_config_invalid",
      message: "Calendar configuration is invalid.",
      worldId,
    });
  }

  return parseResult.data;
}
