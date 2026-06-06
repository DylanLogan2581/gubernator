import { getRequiredRuntimeEnv } from "./env.ts";

import type {
  AdminCreateUserErrorCode,
  AdminCreateUserErrorResponse,
  AdminCreateUserResponse,
} from "./types.ts";

const corsBaseHeaders = {
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-max-age": "86400",
} as const;

export function getAllowedOrigins(): readonly string[] {
  const value = getRequiredRuntimeEnv("ADMIN_CREATE_USER_ALLOWED_ORIGINS");
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
  body: AdminCreateUserResponse,
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
  message,
}: {
  readonly code: AdminCreateUserErrorCode;
  readonly message: string;
}): AdminCreateUserErrorResponse {
  return {
    error: { code, message },
    ok: false,
  };
}
