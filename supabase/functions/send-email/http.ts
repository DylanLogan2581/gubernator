import {
  buildCorsHeaders as buildCorsHeadersShared,
  parseAllowedOrigins,
} from "../_shared/http/cors.ts";
import {
  createErrorResponse as createErrorResponseShared,
  createJsonResponse as createJsonResponseShared,
} from "../_shared/http/response.ts";

import type { SendEmailAnyResponse, SendEmailErrorCode, SendEmailErrorResponse } from "./types.ts";

export function getAllowedOrigins(): readonly string[] {
  return parseAllowedOrigins("SEND_EMAIL_ALLOWED_ORIGINS");
}

export function buildCorsHeaders(allowedOrigin: string | null): Record<string, string> {
  return buildCorsHeadersShared(allowedOrigin);
}

export function createJsonResponse(
  body: SendEmailAnyResponse,
  status: number,
  allowedOrigin: string | null,
): Response {
  return createJsonResponseShared(body, status, allowedOrigin);
}

export function createErrorResponse({
  code,
  message,
}: {
  readonly code: SendEmailErrorCode;
  readonly message: string;
}): SendEmailErrorResponse {
  return createErrorResponseShared({
    code,
    message,
  });
}
