import { resolveSupabaseEndTurnAuthorization } from "./authorize.ts";
import { getEdgeRuntime } from "./env.ts";
import { corsHeaders, createJsonResponse } from "./http.ts";
import { persistSupabaseRunningTransition } from "./persist.ts";
import { resolveSupabaseAuthContext } from "./session.ts";
import { resolveSupabaseEndTurnTransitionInput } from "./state.ts";
import {
  mapDryWriteTransitionResult,
  planDryWriteEndTurnTransition,
} from "./transition.ts";
import { parseEndTurnBasicRequestBody } from "./validate.ts";

import type { EndTurnBasicHandlerOptions } from "./types.ts";

export type {
  EndTurnBasicAuthContext,
  EndTurnBasicAuthContextResult,
  EndTurnBasicAuthorizationResult,
  EndTurnBasicDryWriteTransitionResult,
  EndTurnBasicErrorCode,
  EndTurnBasicErrorResponse,
  EndTurnBasicHandlerOptions,
  EndTurnBasicPersistedTransition,
  EndTurnBasicPersistRunningTransitionResult,
  EndTurnBasicRequestBody,
  EndTurnBasicResponse,
  EndTurnBasicSuccessResponse,
  EndTurnBasicTransitionInputResult,
} from "./types.ts";

export {
  persistSupabaseRunningTransition,
  resolveSupabaseAuthContext,
  resolveSupabaseEndTurnAuthorization,
  resolveSupabaseEndTurnTransitionInput,
};

export async function handleEndTurnBasicRequest(
  request: Request,
  options: EndTurnBasicHandlerOptions = {},
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (request.method !== "POST") {
    return createJsonResponse(
      {
        error: {
          code: "method_not_allowed",
          message: "Use POST to request an end-turn transition.",
        },
        ok: false,
      },
      405,
    );
  }

  const requestBodyResult = await parseEndTurnBasicRequestBody(request);

  if (!requestBodyResult.ok) {
    return createJsonResponse(requestBodyResult.error, 400);
  }

  const resolveAuthContext =
    options.resolveAuthContext ?? resolveSupabaseAuthContext;
  const authContextResult = await resolveAuthContext(request);

  if (!authContextResult.ok) {
    return createJsonResponse(
      authContextResult.error,
      authContextResult.status,
    );
  }

  const resolveAuthorization =
    options.resolveAuthorization ?? resolveSupabaseEndTurnAuthorization;
  const authorizationResult = await resolveAuthorization(
    requestBodyResult.body,
    authContextResult.context,
  );

  if (!authorizationResult.ok) {
    return createJsonResponse(
      authorizationResult.error,
      authorizationResult.status,
    );
  }

  const resolveTransitionInput =
    options.resolveTransitionInput ?? resolveSupabaseEndTurnTransitionInput;
  const transitionInputResult = await resolveTransitionInput(
    requestBodyResult.body,
    authContextResult.context,
  );

  if (!transitionInputResult.ok) {
    return createJsonResponse(
      transitionInputResult.error,
      transitionInputResult.status,
    );
  }

  const plannedTransitionResult = planDryWriteEndTurnTransition(
    transitionInputResult.input,
  );

  if (!plannedTransitionResult.ok) {
    return createJsonResponse(
      plannedTransitionResult.error,
      plannedTransitionResult.status,
    );
  }

  const persistTransition =
    options.persistRunningTransition ?? persistSupabaseRunningTransition;
  const persistedTransitionResult = await persistTransition(
    transitionInputResult.input,
    plannedTransitionResult.transition,
    authContextResult.context,
  );

  if (!persistedTransitionResult.ok) {
    return createJsonResponse(
      persistedTransitionResult.error,
      persistedTransitionResult.status,
    );
  }

  return createJsonResponse(
    {
      data: {
        actorId: authContextResult.context.userId,
        transition: mapDryWriteTransitionResult(
          plannedTransitionResult.transition,
          transitionInputResult.input.calendarConfig.dateFormatTemplate,
        ),
        worldId: requestBodyResult.body.worldId,
      },
      ok: true,
    },
    200,
  );
}

const edgeRuntime = getEdgeRuntime();

if (edgeRuntime !== undefined) {
  edgeRuntime.serve(handleEndTurnBasicRequest);
}
