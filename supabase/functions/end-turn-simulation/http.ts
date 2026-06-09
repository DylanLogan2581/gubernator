import {
  buildCorsHeaders as buildCorsHeadersShared,
  parseAllowedOrigins,
} from "../_shared/http/cors.ts";
import {
  createErrorResponse as createErrorResponseShared,
  createJsonResponse as createJsonResponseShared,
} from "../_shared/http/response.ts";

import type {
  EndTurnSimulationErrorCode,
  EndTurnSimulationErrorResponse,
  EndTurnSimulationResponse,
} from "./types.ts";

export function getAllowedOrigins(): readonly string[] {
  return parseAllowedOrigins("END_TURN_SIMULATION_ALLOWED_ORIGINS");
}

export function buildCorsHeaders(
  allowedOrigin: string | null,
): Record<string, string> {
  return buildCorsHeadersShared(allowedOrigin);
}

export function createJsonResponse(
  body: EndTurnSimulationResponse,
  status: number,
  allowedOrigin: string | null,
): Response {
  return createJsonResponseShared(body, status, allowedOrigin);
}

export function createErrorResponse({
  code,
  details,
  message,
}: {
  readonly code: EndTurnSimulationErrorCode;
  readonly details?: readonly string[];
  readonly message: string;
}): EndTurnSimulationErrorResponse {
  return createErrorResponseShared({
    code,
    details,
    message,
  });
}
