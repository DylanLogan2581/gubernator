import { getRequiredRuntimeEnv } from "./env.ts";

import type {
  EndTurnSimulationErrorCode,
  EndTurnSimulationErrorResponse,
  EndTurnSimulationResponse,
} from "./types.ts";

const corsBaseHeaders = {
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
} as const;

export function getAllowedOrigins(): readonly string[] {
  const value = getRequiredRuntimeEnv("END_TURN_SIMULATION_ALLOWED_ORIGINS");
  if (value === undefined) return [];
  return value
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
}

export function buildCorsHeaders(
  allowedOrigin: string | null,
): Record<string, string> {
  if (allowedOrigin === null) {
    return { ...corsBaseHeaders };
  }
  return {
    ...corsBaseHeaders,
    "access-control-allow-origin": allowedOrigin,
  };
}

export function createJsonResponse(
  body: EndTurnSimulationResponse,
  status: number,
  allowedOrigin: string | null,
): Response {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      ...buildCorsHeaders(allowedOrigin),
    },
    status,
  });
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
  if (details === undefined) {
    return {
      error: {
        code,
        message,
      },
      ok: false,
    };
  }

  return {
    error: {
      code,
      details,
      message,
    },
    ok: false,
  };
}
