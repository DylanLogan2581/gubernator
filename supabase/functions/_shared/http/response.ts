import { buildCorsHeaders } from "./cors.ts";

export function createJsonResponse<T>(
  body: T,
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

export function createErrorResponse<TCode extends string>({
  code,
  details,
  message,
}: {
  readonly code: TCode;
  readonly details?: readonly string[];
  readonly message: string;
}): {
  readonly error: {
    readonly code: TCode;
    readonly details?: readonly string[];
    readonly message: string;
  };
  readonly ok: false;
} {
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
