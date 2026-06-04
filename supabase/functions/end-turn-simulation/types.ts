export type EndTurnSimulationRequestBody = {
  readonly expectedTurnNumber: number;
  readonly worldId: string;
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

export type EndTurnSimulationSuccessResponse = {
  readonly data: {
    readonly actorId: string;
    readonly summary: ApplyTurnTransitionSummary;
    readonly worldId: string;
  };
  readonly ok: true;
};

export type EndTurnSimulationResponse =
  | EndTurnSimulationErrorResponse
  | EndTurnSimulationSuccessResponse;

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

import type { SimulationInputState } from "../../../src/shared/simulation/simulationTypes.ts";

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
