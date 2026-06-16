import { logEndTurnSuccess } from "../_shared/auditLog.ts";
import { getEdgeRuntime } from "../_shared/http/env.ts";

import {
  resolveForecastPreviewAuthorization,
  resolveSupabaseEndTurnSimulationAuthorization,
} from "./authorize.ts";
import { computeForecastSnapshot } from "./forecast.ts";
import {
  buildCorsHeaders,
  createErrorResponse,
  createJsonResponse,
  getAllowedOrigins,
} from "./http.ts";
import { persistSimulationTransition, startTurnTransition } from "./persist.ts";
import { resolveSupabaseSimulationAuthContext } from "./session.ts";
import {
  resolveServiceRoleEndTurnSimulationInput,
  resolveSupabaseEndTurnSimulationInput,
} from "./state.ts";
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

// Placeholder transition id for read-only forecast previews. The simulation
// stamps it into the (discarded) payload; nothing is persisted.
const FORECAST_PREVIEW_TRANSITION_ID = "00000000-0000-0000-0000-00000f0ca570";

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

    // Read-only forecast preview: dry-run the simulation against current state
    // and return the forecast without starting or applying a transition.
    if (validateResult.body.preview === true) {
      const previewAuthResult = await resolveForecastPreviewAuthorization(
        validateResult.body,
        authContextResult.context,
      );
      if (!previewAuthResult.ok) {
        return respond(previewAuthResult.error, previewAuthResult.status);
      }

      // Load preview state with the service-role client so that RLS does not
      // produce a partial view for members without full visibility (e.g. pure
      // settlement managers who lack a player character). Access was already
      // verified above by resolveForecastPreviewAuthorization.
      const previewStateResult = await resolveServiceRoleEndTurnSimulationInput(
        validateResult.body,
      );
      if (!previewStateResult.ok) {
        return respond(previewStateResult.error, previewStateResult.status);
      }

      const previewPlanResult = planSimulationTransition(
        previewStateResult.input,
        FORECAST_PREVIEW_TRANSITION_ID,
      );
      if (!previewPlanResult.ok) {
        return respond(previewPlanResult.error, previewPlanResult.status);
      }

      const previewForecast = computeForecastSnapshot(
        previewPlanResult.result,
        previewStateResult.input,
      );

      return respond({ data: { forecastSnapshot: previewForecast }, ok: true }, 200);
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

    const forecastSnapshot = computeForecastSnapshot(
      transitionResult.result,
      stateResult.input,
    );

    const persistResult = await persistSimulationTransition(
      validateResult.body,
      transitionResult.payload,
      startResult.transitionId,
      authContextResult.context.userId,
      forecastSnapshot,
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
