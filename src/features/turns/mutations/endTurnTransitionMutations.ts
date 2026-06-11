import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { buildingsQueryKeys } from "@/features/buildings";
import { calendarQueryKeys } from "@/features/calendar";
import { citizensQueryKeys } from "@/features/citizens";
import { depositsQueryKeys } from "@/features/deposits";
import { managedPopulationsQueryKeys } from "@/features/managed-populations";
import { notificationQueryKeys } from "@/features/notifications";
import { resourcesQueryKeys } from "@/features/resources";
import { settlementReadinessQueryKeys } from "@/features/settlements";
import { tradeRoutesQueryKeys } from "@/features/trade";
import { worldQueryKeys } from "@/features/worlds";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { turnQueryKeys } from "../queries/turnQueryKeys";

type EndTurnTransitionMutationOptions = UseMutationOptions<
  EndTurnTransitionMutationResult,
  EndTurnTransitionError,
  EndTurnTransitionInput
>;

type EndTurnTransitionExpectedErrorCode =
  | "end_turn_archived_world"
  | "end_turn_running_transition"
  | "end_turn_session_expired"
  | "end_turn_stale_turn"
  | "end_turn_transition_failed"
  | "end_turn_unauthorized";

type EndTurnTransitionFunctionErrorCode =
  | "auth_context_unavailable"
  | "end_turn_calendar_config_invalid"
  | "end_turn_running_transition"
  | "end_turn_stale_expected_turn"
  | "end_turn_state_drifted"
  | "end_turn_state_unavailable"
  | "end_turn_transition_failed"
  | "end_turn_transition_unavailable"
  | "end_turn_world_archived"
  | "end_turn_world_not_found"
  | "invalid_request"
  | "method_not_allowed"
  | "not_implemented"
  | "session_expired"
  | "unauthenticated"
  | "unauthorized";

type EndTurnTransitionFunctionResponse =
  | EndTurnTransitionFunctionErrorResponse
  | EndTurnTransitionFunctionSuccessResponse;

type EndTurnTransitionFunctionErrorResponse = {
  readonly error: {
    readonly code: string;
    readonly message: string;
  };
  readonly ok: false;
};

type EndTurnTransitionFunctionSuccessResponse = {
  readonly data: EndTurnTransitionMutationResult;
  readonly ok: true;
};

export type EndTurnTransitionInput = {
  readonly expectedTurnNumber: number;
  readonly worldId: string;
};

export type PatchCounts = {
  readonly assignmentClears: number;
  readonly bornOnTurnBackfill: number;
  readonly buildingStateChanges: number;
  readonly buildingsCreated: number;
  readonly citizenBirths: number;
  readonly citizenDeaths: number;
  readonly constructionUpdates: number;
  readonly depositUpdates: number;
  readonly logEntries: number;
  readonly managedPopulationUpdates: number;
  readonly notifications: number;
  readonly overshootStamped: number;
  readonly partnershipChanges: number;
  readonly readinessReset: number;
  readonly settlementSnapshots: number;
  readonly stockpileDeltas: number;
  readonly tradeRouteOutcomes: number;
};

export type EndTurnTransitionSummary = {
  readonly currentTurnNumber: number;
  readonly fromTurnNumber: number;
  readonly patchCounts: PatchCounts;
  readonly toTurnNumber: number;
  readonly transitionId: string;
};

export type EndTurnTransitionMutationResult = {
  readonly actorId: string;
  readonly summary: EndTurnTransitionSummary;
  readonly worldId: string;
};

export class EndTurnTransitionError extends Error {
  readonly code: EndTurnTransitionExpectedErrorCode;
  readonly worldId: string;

  constructor({
    code,
    message,
    worldId,
  }: {
    readonly code: EndTurnTransitionExpectedErrorCode;
    readonly message: string;
    readonly worldId: string;
  }) {
    super(message);
    this.name = "EndTurnTransitionError";
    this.code = code;
    this.worldId = worldId;
  }
}

export function endTurnTransitionMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): EndTurnTransitionMutationOptions {
  return mutationOptions({
    mutationFn: (input: EndTurnTransitionInput) =>
      endTurnTransition(client, input),
    mutationKey: [...turnQueryKeys.all, "end-turn-simulation"],
    onSuccess: async (_result, input): Promise<void> => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: worldQueryKeys.all }),
        queryClient.invalidateQueries({
          queryKey: turnQueryKeys.currentTurnState(input.worldId),
        }),
        queryClient.invalidateQueries({ queryKey: calendarQueryKeys.all }),
        queryClient.invalidateQueries({
          queryKey: settlementReadinessQueryKeys.list(input.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: settlementReadinessQueryKeys.summary(input.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: turnQueryKeys.latestTransitionStatus(input.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: turnQueryKeys.latestTransitionOutcome(input.worldId),
        }),
        queryClient.invalidateQueries({
          queryKey: turnQueryKeys.latestSettlementTransitionOutcomeAll(),
        }),
        queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: resourcesQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: buildingsQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: depositsQueryKeys.all }),
        queryClient.invalidateQueries({
          queryKey: managedPopulationsQueryKeys.all,
        }),
        queryClient.invalidateQueries({ queryKey: tradeRoutesQueryKeys.all }),
        queryClient.invalidateQueries({ queryKey: citizensQueryKeys.all }),
      ]);
    },
  });
}

export function isEndTurnTransitionError(
  error: unknown,
): error is EndTurnTransitionError {
  return error instanceof EndTurnTransitionError;
}

async function endTurnTransition(
  client: GubernatorSupabaseClient,
  input: EndTurnTransitionInput,
): Promise<EndTurnTransitionMutationResult> {
  const response = await client.functions.invoke<unknown>(
    "end-turn-simulation",
    {
      body: {
        expectedTurnNumber: input.expectedTurnNumber,
        worldId: input.worldId,
      },
    },
  );

  if (response.error !== null) {
    const errorResponse = await readFunctionErrorResponse(response.error);

    if (errorResponse !== null) {
      throw toEndTurnTransitionError(errorResponse.error, input.worldId);
    }

    throw new EndTurnTransitionError({
      code: "end_turn_transition_failed",
      message: "End turn transition could not be started.",
      worldId: input.worldId,
    });
  }

  if (isEndTurnTransitionFunctionResponse(response.data)) {
    if (response.data.ok) {
      return response.data.data;
    }

    throw toEndTurnTransitionError(response.data.error, input.worldId);
  }

  throw new EndTurnTransitionError({
    code: "end_turn_transition_failed",
    message: "End turn transition response was invalid.",
    worldId: input.worldId,
  });
}

async function readFunctionErrorResponse(
  error: unknown,
): Promise<EndTurnTransitionFunctionErrorResponse | null> {
  const context = getFunctionErrorContext(error);

  if (context === null) {
    return null;
  }

  try {
    const payload: unknown = await context.json();

    if (isEndTurnTransitionFunctionErrorResponse(payload)) {
      return payload;
    }
  } catch {
    return null;
  }

  return null;
}

function getFunctionErrorContext(error: unknown): ResponseJsonReader | null {
  if (!isRecord(error)) {
    return null;
  }

  const context = error.context;

  if (isResponseJsonReader(context)) {
    return context;
  }

  return null;
}

function toEndTurnTransitionError(
  error: EndTurnTransitionFunctionErrorResponse["error"],
  worldId: string,
): EndTurnTransitionError {
  return new EndTurnTransitionError({
    code: normalizeEndTurnTransitionErrorCode(error.code),
    message: error.message,
    worldId,
  });
}

function normalizeEndTurnTransitionErrorCode(
  code: string,
): EndTurnTransitionExpectedErrorCode {
  switch (code as EndTurnTransitionFunctionErrorCode) {
    case "end_turn_stale_expected_turn":
    case "end_turn_state_drifted":
      return "end_turn_stale_turn";
    case "session_expired":
      return "end_turn_session_expired";
    case "auth_context_unavailable":
    case "unauthenticated":
    case "unauthorized":
    case "end_turn_world_not_found":
      return "end_turn_unauthorized";
    case "end_turn_world_archived":
      return "end_turn_archived_world";
    case "end_turn_running_transition":
      return "end_turn_running_transition";
    case "end_turn_calendar_config_invalid":
    case "end_turn_state_unavailable":
    case "end_turn_transition_failed":
    case "end_turn_transition_unavailable":
    case "invalid_request":
    case "method_not_allowed":
    case "not_implemented":
      return "end_turn_transition_failed";
  }

  return "end_turn_transition_failed";
}

function isEndTurnTransitionFunctionResponse(
  value: unknown,
): value is EndTurnTransitionFunctionResponse {
  return (
    isEndTurnTransitionFunctionSuccessResponse(value) ||
    isEndTurnTransitionFunctionErrorResponse(value)
  );
}

function isEndTurnTransitionFunctionSuccessResponse(
  value: unknown,
): value is EndTurnTransitionFunctionSuccessResponse {
  return (
    isRecord(value) &&
    value.ok === true &&
    isEndTurnTransitionMutationResult(value.data)
  );
}

function isEndTurnTransitionFunctionErrorResponse(
  value: unknown,
): value is EndTurnTransitionFunctionErrorResponse {
  return (
    isRecord(value) &&
    value.ok === false &&
    isRecord(value.error) &&
    typeof value.error.code === "string" &&
    typeof value.error.message === "string"
  );
}

function isPatchCounts(value: unknown): value is PatchCounts {
  return (
    isRecord(value) &&
    typeof value.assignmentClears === "number" &&
    typeof value.bornOnTurnBackfill === "number" &&
    typeof value.buildingStateChanges === "number" &&
    typeof value.buildingsCreated === "number" &&
    typeof value.citizenBirths === "number" &&
    typeof value.citizenDeaths === "number" &&
    typeof value.constructionUpdates === "number" &&
    typeof value.depositUpdates === "number" &&
    typeof value.logEntries === "number" &&
    typeof value.managedPopulationUpdates === "number" &&
    typeof value.notifications === "number" &&
    typeof value.overshootStamped === "number" &&
    typeof value.partnershipChanges === "number" &&
    typeof value.readinessReset === "number" &&
    typeof value.settlementSnapshots === "number" &&
    typeof value.stockpileDeltas === "number" &&
    typeof value.tradeRouteOutcomes === "number"
  );
}

function isEndTurnTransitionSummary(
  value: unknown,
): value is EndTurnTransitionSummary {
  return (
    isRecord(value) &&
    typeof value.currentTurnNumber === "number" &&
    typeof value.fromTurnNumber === "number" &&
    isPatchCounts(value.patchCounts) &&
    typeof value.toTurnNumber === "number" &&
    typeof value.transitionId === "string"
  );
}

function isEndTurnTransitionMutationResult(
  value: unknown,
): value is EndTurnTransitionMutationResult {
  return (
    isRecord(value) &&
    typeof value.actorId === "string" &&
    isEndTurnTransitionSummary(value.summary) &&
    typeof value.worldId === "string"
  );
}

type ResponseJsonReader = {
  readonly json: () => Promise<unknown>;
};

function isResponseJsonReader(value: unknown): value is ResponseJsonReader {
  return isRecord(value) && typeof value.json === "function";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
