import type {
  EndTurnBasicErrorCode,
  EndTurnBasicErrorResponse,
  EndTurnBasicResponse,
} from "./types.ts";

export const corsHeaders = {
  "access-control-allow-headers":
    "authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-origin": "*",
} as const;

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  ...corsHeaders,
} as const;

export function createJsonResponse(
  body: EndTurnBasicResponse,
  status: number,
): Response {
  return new Response(JSON.stringify(body), {
    headers: jsonHeaders,
    status,
  });
}

export function createErrorResponse({
  code,
  details,
  message,
}: {
  readonly code: EndTurnBasicErrorCode;
  readonly details?: readonly string[];
  readonly message: string;
}): EndTurnBasicErrorResponse {
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
