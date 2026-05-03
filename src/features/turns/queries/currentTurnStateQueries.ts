import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeAuthError, type AuthUiError } from "@/features/auth";
import {
  formatCalendarDate,
  formatCalendarYear,
  resolveTurnCalendarDate,
  worldCalendarConfigSchema,
} from "@/features/calendar";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { turnQueryKeys } from "./turnQueryKeys";

import type { CurrentTurnDateDisplay } from "../types/currentTurnTypes";

type CurrentTurnStateQueryKey = ReturnType<
  typeof turnQueryKeys.currentTurnState
>;
type CurrentTurnStateQueryOptions = UseQueryOptions<
  CurrentTurnDateDisplay,
  AuthUiError | CurrentTurnStateError,
  CurrentTurnDateDisplay,
  CurrentTurnStateQueryKey
>;
type CurrentTurnStateErrorCode =
  | "current_turn_calendar_config_invalid"
  | "current_turn_calendar_config_missing"
  | "current_turn_number_invalid"
  | "current_turn_state_unauthorized";

const CURRENT_TURN_STATE_SELECT = "current_turn_number,calendar_config_json";

export class CurrentTurnStateError extends Error {
  readonly code: CurrentTurnStateErrorCode;
  readonly worldId: string;

  constructor({
    code,
    message,
    worldId,
  }: {
    readonly code: CurrentTurnStateErrorCode;
    readonly message: string;
    readonly worldId: string;
  }) {
    super(message);
    this.name = "CurrentTurnStateError";
    this.code = code;
    this.worldId = worldId;
  }
}

export function currentTurnStateQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): CurrentTurnStateQueryOptions {
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getCurrentTurnState(client, worldId),
    queryKey: turnQueryKeys.currentTurnState(worldId),
    retry: shouldRetryCurrentTurnStateQuery,
  });
}

export function shouldRetryCurrentTurnStateQuery(
  failureCount: number,
  error: Error,
): boolean {
  return failureCount < 3 && !isCurrentTurnStateError(error);
}

export function isCurrentTurnStateError(
  error: unknown,
): error is CurrentTurnStateError {
  return error instanceof CurrentTurnStateError;
}

async function getCurrentTurnState(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<CurrentTurnDateDisplay> {
  const { data, error } = await client
    .from("worlds")
    .select(CURRENT_TURN_STATE_SELECT)
    .eq("id", worldId)
    .maybeSingle();

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  if (data === null) {
    throw new CurrentTurnStateError({
      code: "current_turn_state_unauthorized",
      message: "Current turn state is unavailable.",
      worldId,
    });
  }

  const storedTurnNumber = data.current_turn_number;

  if (!Number.isInteger(storedTurnNumber) || storedTurnNumber < 0) {
    throw new CurrentTurnStateError({
      code: "current_turn_number_invalid",
      message: "Current turn number is invalid.",
      worldId,
    });
  }

  if (data.calendar_config_json === null) {
    throw new CurrentTurnStateError({
      code: "current_turn_calendar_config_missing",
      message: "Calendar configuration is unavailable.",
      worldId,
    });
  }

  const parseResult = worldCalendarConfigSchema.safeParse(
    data.calendar_config_json,
  );

  if (!parseResult.success) {
    throw new CurrentTurnStateError({
      code: "current_turn_calendar_config_invalid",
      message: "Calendar configuration is invalid.",
      worldId,
    });
  }

  const calendarConfig = parseResult.data;
  const currentTurnNumber = Math.max(1, storedTurnNumber);
  const computedDate = resolveTurnCalendarDate(
    calendarConfig,
    currentTurnNumber,
  );

  return {
    calendarConfig,
    computedDate,
    currentTurnNumber,
    displayLabels: {
      compactDateLabel: formatCalendarDate(computedDate, {
        displayVariant: "compact",
        yearFormatTemplate: calendarConfig.yearFormatTemplate,
      }),
      dateLabel: formatCalendarDate(computedDate, {
        displayVariant: "full",
        yearFormatTemplate: calendarConfig.yearFormatTemplate,
      }),
      turnLabel: `Turn ${currentTurnNumber}`,
      yearLabel: formatCalendarYear(
        computedDate.year,
        calendarConfig.yearFormatTemplate,
      ),
    },
    worldId,
  };
}
