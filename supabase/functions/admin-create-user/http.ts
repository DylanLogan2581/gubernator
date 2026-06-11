import {
  buildCorsHeaders as buildCorsHeadersShared,
  parseAllowedOrigins,
} from "../_shared/http/cors.ts";
import {
  createErrorResponse as createErrorResponseShared,
  createJsonResponse as createJsonResponseShared,
} from "../_shared/http/response.ts";

import type {
  AdminCreateUserErrorCode,
  AdminCreateUserErrorResponse,
  AdminCreateUserResponse,
} from "./types.ts";

export function getAllowedOrigins(): readonly string[] {
  return parseAllowedOrigins("ADMIN_CREATE_USER_ALLOWED_ORIGINS");
}

export function buildCorsHeaders(
  allowedOrigin: string | null,
): Record<string, string> {
  return buildCorsHeadersShared(allowedOrigin);
}

export function createJsonResponse(
  body: AdminCreateUserResponse,
  status: number,
  allowedOrigin: string | null,
): Response {
  return createJsonResponseShared(body, status, allowedOrigin);
}

export function createErrorResponse({
  code,
  message,
}: {
  readonly code: AdminCreateUserErrorCode;
  readonly message: string;
}): AdminCreateUserErrorResponse {
  return createErrorResponseShared({
    code,
    message,
  });
}
