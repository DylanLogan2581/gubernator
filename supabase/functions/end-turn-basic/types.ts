import type {
  BasicEndTurnTransitionInput,
  BasicEndTurnTransitionResult,
} from "../../../src/shared/endTurnTransitionTypes.ts";

export type EndTurnBasicRequestBody = {
  readonly expectedTurnNumber: number;
  readonly worldId: string;
};

export type EndTurnBasicErrorCode =
  | "auth_context_unavailable"
  | "end_turn_calendar_config_invalid"
  | "end_turn_running_transition"
  | "end_turn_stale_expected_turn"
  | "end_turn_state_unavailable"
  | "end_turn_transition_failed"
  | "end_turn_transition_unavailable"
  | "end_turn_world_archived"
  | "end_turn_world_not_found"
  | "invalid_request"
  | "method_not_allowed"
  | "unauthorized"
  | "unauthenticated";

export type EndTurnBasicErrorResponse = {
  readonly error: {
    readonly code: EndTurnBasicErrorCode;
    readonly details?: readonly string[];
    readonly message: string;
  };
  readonly ok: false;
};

export type EndTurnBasicSuccessResponse = {
  readonly data: {
    readonly actorId: string;
    readonly transition: EndTurnBasicDryWriteTransitionResult;
    readonly worldId: string;
  };
  readonly ok: true;
};

export type EndTurnBasicResponse =
  | EndTurnBasicErrorResponse
  | EndTurnBasicSuccessResponse;

export type EndTurnBasicDryWriteTransitionResult = {
  readonly nextDate: BasicEndTurnTransitionResult["nextDate"];
  readonly nextDateLabel: string;
  readonly nextTurnNumber: number;
  readonly previousDate: BasicEndTurnTransitionResult["previousDate"];
  readonly previousDateLabel: string;
  readonly previousTurnNumber: number;
  readonly readinessSummary: BasicEndTurnTransitionResult["readinessSummary"];
};

export type EndTurnBasicAuthContext = {
  readonly authorizationHeader?: string;
  readonly userId: string;
};

export type EndTurnBasicPersistedTransition = {
  readonly fromTurnNumber: number;
  readonly id: string;
  readonly initiatedByUserId: string;
  readonly startedAt: string;
  readonly status: "completed" | "failed" | "running";
  readonly toTurnNumber: number;
  readonly worldId: string;
};

export type EndTurnBasicAuthContextResult =
  | {
      readonly context: EndTurnBasicAuthContext;
      readonly ok: true;
    }
  | {
      readonly error: EndTurnBasicErrorResponse;
      readonly ok: false;
      readonly status: number;
    };

export type EndTurnBasicAuthorizationResult =
  | {
      readonly ok: true;
    }
  | {
      readonly error: EndTurnBasicErrorResponse;
      readonly ok: false;
      readonly status: number;
    };

export type EndTurnBasicTransitionInputResult =
  | {
      readonly input: BasicEndTurnTransitionInput;
      readonly ok: true;
    }
  | {
      readonly error: EndTurnBasicErrorResponse;
      readonly ok: false;
      readonly status: number;
    };

export type EndTurnBasicPersistRunningTransitionResult =
  | {
      readonly ok: true;
      readonly transition: EndTurnBasicPersistedTransition;
    }
  | {
      readonly error: EndTurnBasicErrorResponse;
      readonly ok: false;
      readonly status: number;
    };

export type EndTurnBasicHandlerOptions = {
  readonly resolveTransitionInput?: (
    requestBody: EndTurnBasicRequestBody,
    authContext: EndTurnBasicAuthContext,
  ) => Promise<EndTurnBasicTransitionInputResult>;
  readonly resolveAuthorization?: (
    requestBody: EndTurnBasicRequestBody,
    authContext: EndTurnBasicAuthContext,
  ) => Promise<EndTurnBasicAuthorizationResult>;
  readonly resolveAuthContext?: (
    request: Request,
  ) => Promise<EndTurnBasicAuthContextResult>;
  readonly persistRunningTransition?: (
    input: BasicEndTurnTransitionInput,
    transition: BasicEndTurnTransitionResult,
    authContext: EndTurnBasicAuthContext,
  ) => Promise<EndTurnBasicPersistRunningTransitionResult>;
};
