import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeAuthError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { turnQueryKeys } from "./turnQueryKeys";

import type {
  LatestTurnTransitionStatus,
  TurnTransitionState,
} from "../types/turnTransitionStatusTypes";

type LatestTurnTransitionStatusQueryKey = ReturnType<
  typeof turnQueryKeys.latestTransitionStatus
>;
type LatestTurnTransitionStatusQueryOptions = UseQueryOptions<
  LatestTurnTransitionStatus | null,
  AuthUiError | LatestTurnTransitionStatusError,
  LatestTurnTransitionStatus | null,
  LatestTurnTransitionStatusQueryKey
>;
type LatestTurnTransitionStatusErrorCode =
  | "latest_turn_transition_status_invalid"
  | "latest_turn_transition_status_unauthorized";
type LatestTurnTransitionStatusRow = {
  readonly finished_at: string | null;
  readonly from_turn_number: number;
  readonly id: string;
  readonly started_at: string;
  readonly status: string;
  readonly to_turn_number: number;
  readonly world_id: string;
};

const LATEST_TURN_TRANSITION_STATUS_SELECT =
  "id,world_id,from_turn_number,to_turn_number,status,started_at,finished_at";
const TURN_TRANSITION_STATES = ["running", "completed", "failed"] as const;

export class LatestTurnTransitionStatusError extends Error {
  readonly code: LatestTurnTransitionStatusErrorCode;
  readonly worldId: string;

  constructor({
    code,
    message,
    worldId,
  }: {
    readonly code: LatestTurnTransitionStatusErrorCode;
    readonly message: string;
    readonly worldId: string;
  }) {
    super(message);
    this.name = "LatestTurnTransitionStatusError";
    this.code = code;
    this.worldId = worldId;
  }
}

export function latestTurnTransitionStatusQueryOptions(
  worldId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): LatestTurnTransitionStatusQueryOptions {
  // The client is the configured Supabase singleton in app code; tests inject a fake.
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getLatestTurnTransitionStatus(client, worldId),
    queryKey: turnQueryKeys.latestTransitionStatus(worldId),
    retry: shouldRetryLatestTurnTransitionStatusQuery,
  });
}

export function shouldRetryLatestTurnTransitionStatusQuery(
  failureCount: number,
  error: Error,
): boolean {
  return failureCount < 3 && !isLatestTurnTransitionStatusError(error);
}

export function isLatestTurnTransitionStatusError(
  error: unknown,
): error is LatestTurnTransitionStatusError {
  return error instanceof LatestTurnTransitionStatusError;
}

async function getLatestTurnTransitionStatus(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<LatestTurnTransitionStatus | null> {
  const { data, error } = await client
    .from("turn_transitions")
    .select(LATEST_TURN_TRANSITION_STATUS_SELECT)
    .eq("world_id", worldId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  if (data === null) {
    await assertWorldIsVisible(client, worldId);

    return null;
  }

  return toLatestTurnTransitionStatus(data, worldId);
}

async function assertWorldIsVisible(
  client: GubernatorSupabaseClient,
  worldId: string,
): Promise<void> {
  const { data, error } = await client
    .from("worlds")
    .select("id")
    .eq("id", worldId)
    .maybeSingle();

  if (error !== null) {
    throw normalizeAuthError(error);
  }

  if (data === null) {
    throw new LatestTurnTransitionStatusError({
      code: "latest_turn_transition_status_unauthorized",
      message: "Latest turn transition status is unavailable.",
      worldId,
    });
  }
}

function toLatestTurnTransitionStatus(
  row: LatestTurnTransitionStatusRow,
  worldId: string,
): LatestTurnTransitionStatus {
  if (!isTurnTransitionState(row.status)) {
    throw new LatestTurnTransitionStatusError({
      code: "latest_turn_transition_status_invalid",
      message: "Latest turn transition status is invalid.",
      worldId,
    });
  }

  return {
    finishedAt: row.finished_at,
    fromTurnNumber: row.from_turn_number,
    id: row.id,
    isRunning: row.status === "running",
    startedAt: row.started_at,
    state: row.status,
    toTurnNumber: row.to_turn_number,
    worldId: row.world_id,
  };
}

function isTurnTransitionState(status: string): status is TurnTransitionState {
  return TURN_TRANSITION_STATES.some((state) => state === status);
}
