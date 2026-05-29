import { resolveSupabaseEndTurnAuthorization } from "./authorize.ts";
import { getEdgeRuntime } from "./env.ts";
import {
  buildCorsHeaders,
  createJsonResponse,
  getAllowedOrigins,
} from "./http.ts";
import { persistSupabaseRunningTransition } from "./persist.ts";
import { resolveSupabaseAuthContext } from "./session.ts";
import { resolveSupabaseEndTurnTransitionInput } from "./state.ts";
import {
  mapDryWriteTransitionResult,
  planDryWriteEndTurnTransition,
} from "./transition.ts";
import { parseEndTurnBasicRequestBody } from "./validate.ts";

import type {
  EndTurnBasicHandlerOptions,
  EndTurnBasicResponse,
} from "./types.ts";

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
  const allowedOrigins = options.allowedOrigins ?? getAllowedOrigins();
  const origin = request.headers.get("origin");

  if (origin !== null && !allowedOrigins.includes(origin)) {
    return new Response(null, { status: 403 });
  }

  const allowedOrigin = origin;
  const corsHeaders = buildCorsHeaders(allowedOrigin);

  const respond = (body: EndTurnBasicResponse, status: number): Response =>
    createJsonResponse(body, status, allowedOrigin);

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (request.method !== "POST") {
    return respond(
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
    return respond(requestBodyResult.error, 400);
  }

  const resolveAuthContext =
    options.resolveAuthContext ?? resolveSupabaseAuthContext;
  const authContextResult = await resolveAuthContext(request);

  if (!authContextResult.ok) {
    return respond(authContextResult.error, authContextResult.status);
  }

  const resolveAuthorization =
    options.resolveAuthorization ?? resolveSupabaseEndTurnAuthorization;
  const authorizationResult = await resolveAuthorization(
    requestBodyResult.body,
    authContextResult.context,
  );

  if (!authorizationResult.ok) {
    return respond(authorizationResult.error, authorizationResult.status);
  }

  const resolveTransitionInput =
    options.resolveTransitionInput ?? resolveSupabaseEndTurnTransitionInput;
  const transitionInputResult = await resolveTransitionInput(
    requestBodyResult.body,
    authContextResult.context,
  );

  if (!transitionInputResult.ok) {
    return respond(transitionInputResult.error, transitionInputResult.status);
  }

  const plannedTransitionResult = planDryWriteEndTurnTransition(
    transitionInputResult.input,
  );

  if (!plannedTransitionResult.ok) {
    return respond(
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
    return respond(
      persistedTransitionResult.error,
      persistedTransitionResult.status,
    );
  }

  return respond(
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
