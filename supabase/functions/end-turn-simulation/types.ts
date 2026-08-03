export type EndTurnSimulationRequestBody = {
  readonly expectedTurnNumber: number;
  readonly worldId: string;
  // When true, run a read-only dry-run and return the forecast without
  // starting or applying a transition (no DB writes).
  readonly preview?: boolean;
};

export type EndTurnSimulationErrorCode =
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
  | "origin_not_allowed"
  | "rate_limit_exceeded"
  | "session_expired"
  | "unauthorized"
  | "unauthenticated";

export type EndTurnSimulationErrorResponse = {
  readonly error: {
    readonly code: EndTurnSimulationErrorCode;
    readonly details?: readonly string[];
    readonly message: string;
  };
  readonly ok: false;
};

// #1278: the request no longer runs the turn. It starts the transition, queues
// the job, and hands back the ids the client polls on; the summary arrives via
// turn_transitions once the background worker finishes.
export type EndTurnSimulationAcceptedResponse = {
  readonly data: {
    readonly actorId: string;
    readonly jobId: string;
    readonly transitionId: string;
    readonly worldId: string;
  };
  readonly ok: true;
};

export type EndTurnSimulationForecastResponse = {
  readonly data: {
    readonly forecastSnapshot: unknown;
  };
  readonly ok: true;
};

export type EndTurnSimulationResponse =
  | EndTurnSimulationAcceptedResponse
  | EndTurnSimulationErrorResponse
  | EndTurnSimulationForecastResponse;

export type EndTurnSimulationAuthContext = {
  readonly authorizationHeader?: string;
  readonly userId: string;
};

export type EndTurnSimulationAuthContextResult =
  | {
    readonly context: EndTurnSimulationAuthContext;
    readonly ok: true;
  }
  | {
    readonly error: EndTurnSimulationErrorResponse;
    readonly ok: false;
    readonly status: number;
  };

export type EndTurnSimulationAuthorizationResult =
  | {
    readonly ok: true;
  }
  | {
    readonly error: EndTurnSimulationErrorResponse;
    readonly ok: false;
    readonly status: number;
  };

export type EndTurnSimulationHandlerOptions = {
  readonly allowedOrigins?: readonly string[];
};

import type { SimulationInputState } from "../_shared/simulation/simulationTypes.ts";

export type EndTurnSimulationStateResult =
  | {
    readonly input: SimulationInputState;
    readonly ok: true;
  }
  | {
    readonly error: EndTurnSimulationErrorResponse;
    readonly ok: false;
    readonly status: number;
  };

export type ApplyTurnTransitionSummary = {
  readonly currentTurnNumber: number;
  readonly fromTurnNumber: number;
  readonly patchCounts: Record<string, number>;
  readonly toTurnNumber: number;
  readonly transitionId: string;
};

export type EndTurnSimulationPersistResult =
  | {
    readonly ok: true;
    readonly summary: ApplyTurnTransitionSummary;
  }
  | {
    readonly error: EndTurnSimulationErrorResponse;
    readonly ok: false;
    readonly status: number;
  };
