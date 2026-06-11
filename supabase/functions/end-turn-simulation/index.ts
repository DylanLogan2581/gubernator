import { logEndTurnSuccess } from "../_shared/auditLog.ts";
import { getEdgeRuntime } from "../_shared/http/env.ts";

import { resolveSupabaseEndTurnSimulationAuthorization } from "./authorize.ts";
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

import type { EndTurnSimulationHandlerOptions, EndTurnSimulationResponse } from "./types.ts";

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
  try {
    const allowedOrigins = options.allowedOrigins ?? getAllowedOrigins();
    const origin = request.headers.get("origin");

    // CORS allowlist is enforced for browser requests (those with an Origin header).
    // Requests without the Origin header (non-browser clients, scripts, servers)
    // bypass this check and proceed to the JWT + super-admin/world-admin checks,
    // which are the actual access boundary.
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

    const respond = (
      body: EndTurnSimulationResponse,
      status: number,
    ): Response => createJsonResponse(body, status, allowedOrigin);

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

    const authorizationResult = await resolveSupabaseEndTurnSimulationAuthorization(
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
      authContextResult.context.userId,
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
  } catch (error) {
    // Handle unexpected errors with CORS headers
    const origin = request.headers.get("origin");
    const allowedOrigins = options.allowedOrigins ?? getAllowedOrigins();
    const allowedOrigin = origin !== null && allowedOrigins.includes(origin) ? origin : null;

    console.error("[end-turn-simulation] Unexpected error:", error);

    return createJsonResponse(
      createErrorResponse({
        code: "end_turn_transition_failed",
        message: "An unexpected error occurred during turn advancement.",
      }),
      500,
      allowedOrigin,
    );
  }
}

const edgeRuntime = getEdgeRuntime();

if (edgeRuntime !== undefined) {
  edgeRuntime.serve(handleEndTurnSimulationRequest);
}
