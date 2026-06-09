import { logEndTurnSuccess } from "../_shared/auditLog.ts";

import { resolveSupabaseEndTurnSimulationAuthorization } from "./authorize.ts";
import { getEdgeRuntime } from "./env.ts";
import {
  buildCorsHeaders,
  createErrorResponse,
  createJsonResponse,
  getAllowedOrigins,
} from "./http.ts";
import { persistSimulationTransition, startTurnTransition } from "./persist.ts";
import { resolveSupabaseSimulationAuthContext } from "./session.ts";
import { resolveSupabaseEndTurnSimulationInput } from "./state.ts";
import { planSimulationTransition } from "./transition.ts";
import { parseEndTurnSimulationRequestBody } from "./validate.ts";

import type {
  EndTurnSimulationHandlerOptions,
  EndTurnSimulationResponse,
} from "./types.ts";

export type {
  EndTurnSimulationAuthContext,
  EndTurnSimulationAuthContextResult,
  EndTurnSimulationAuthorizationResult,
  EndTurnSimulationErrorCode,
  EndTurnSimulationErrorResponse,
  EndTurnSimulationHandlerOptions,
  EndTurnSimulationRequestBody,
  EndTurnSimulationResponse,
  EndTurnSimulationSuccessResponse,
} from "./types.ts";

export async function handleEndTurnSimulationRequest(
  request: Request,
  options: EndTurnSimulationHandlerOptions = {},
): Promise<Response> {
  const allowedOrigins = options.allowedOrigins ?? getAllowedOrigins();
  const origin = request.headers.get("origin");

  if (origin !== null && !allowedOrigins.includes(origin)) {
    return createJsonResponse(
      createErrorResponse({
        code: "origin_not_allowed",
        message: "Origin not allowed.",
      }),
      403,
      null,
    );
  }

  const allowedOrigin = origin;
  const corsHeaders = buildCorsHeaders(allowedOrigin);

  const respond = (body: EndTurnSimulationResponse, status: number): Response =>
    createJsonResponse(body, status, allowedOrigin);

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders, status: 204 });
  }

  if (request.method !== "POST") {
    return respond(
      createErrorResponse({
        code: "method_not_allowed",
        message: "Use POST to request an end-turn simulation.",
      }),
      405,
    );
  }

  const validateResult = await parseEndTurnSimulationRequestBody(request);
  if (!validateResult.ok) {
    return respond(validateResult.error, 400);
  }

  const authContextResult = await resolveSupabaseSimulationAuthContext(request);
  if (!authContextResult.ok) {
    return respond(authContextResult.error, authContextResult.status);
  }

  const authorizationResult =
    await resolveSupabaseEndTurnSimulationAuthorization(
      validateResult.body,
      authContextResult.context,
    );
  if (!authorizationResult.ok) {
    return respond(authorizationResult.error, authorizationResult.status);
  }

  const stateResult = await resolveSupabaseEndTurnSimulationInput(
    validateResult.body,
    authContextResult.context,
  );
  if (!stateResult.ok) {
    return respond(stateResult.error, stateResult.status);
  }

  const startResult = await startTurnTransition(
    validateResult.body,
    authContextResult.context,
  );
  if (!startResult.ok) {
    return respond(startResult.error, startResult.status);
  }

  const transitionResult = planSimulationTransition(
    stateResult.input,
    startResult.transitionId,
  );
  if (!transitionResult.ok) {
    return respond(transitionResult.error, transitionResult.status);
  }

  const persistResult = await persistSimulationTransition(
    validateResult.body,
    transitionResult.payload,
    startResult.transitionId,
  );
  if (!persistResult.ok) {
    return respond(persistResult.error, persistResult.status);
  }

  logEndTurnSuccess(
    authContextResult.context.userId,
    validateResult.body.worldId,
    persistResult.summary.fromTurnNumber,
    persistResult.summary.toTurnNumber,
    startResult.transitionId,
  );

  return respond(
    {
      data: {
        actorId: authContextResult.context.userId,
        summary: persistResult.summary,
        worldId: validateResult.body.worldId,
      },
      ok: true,
    },
    200,
  );
}

const edgeRuntime = getEdgeRuntime();

if (edgeRuntime !== undefined) {
  edgeRuntime.serve(handleEndTurnSimulationRequest);
}
