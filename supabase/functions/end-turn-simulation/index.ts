import { getEdgeRuntime } from "./env.ts";
import {
  buildCorsHeaders,
  createJsonResponse,
  getAllowedOrigins,
} from "./http.ts";

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

export function handleEndTurnSimulationRequest(
  request: Request,
  options: EndTurnSimulationHandlerOptions = {},
): Response {
  const allowedOrigins = options.allowedOrigins ?? getAllowedOrigins();
  const origin = request.headers.get("origin");

  if (origin !== null && !allowedOrigins.includes(origin)) {
    return new Response(null, { status: 403 });
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
      {
        error: {
          code: "method_not_allowed",
          message: "Use POST to request an end-turn simulation.",
        },
        ok: false,
      },
      405,
    );
  }

  return respond(
    {
      error: {
        code: "not_implemented",
        message: "end-turn-simulation is not yet wired",
      },
      ok: false,
    },
    501,
  );
}

const edgeRuntime = getEdgeRuntime();

if (edgeRuntime !== undefined) {
  edgeRuntime.serve(handleEndTurnSimulationRequest);
}
