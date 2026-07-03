import { readCappedJsonBody } from "../_shared/http/body.ts";
import { createErrorResponse } from "../_shared/http/response.ts";

import type { ReadCappedJsonBodyFailureReason } from "../_shared/http/body.ts";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_BODY_SIZE = 1024 * 10; // 10 KB

export type ExportWorldTemplateRequestBody = {
  readonly worldId: string;
};

export type ExportWorldTemplateErrorBody = {
  readonly error: { readonly code: string; readonly message: string };
  readonly ok: false;
};

export async function parseExportWorldTemplateRequestBody(
  request: Request,
): Promise<
  | { readonly body: ExportWorldTemplateRequestBody; readonly ok: true }
  | {
    readonly error: ExportWorldTemplateErrorBody;
    readonly ok: false;
    readonly status: number;
  }
> {
  const readResult = await readCappedJsonBody(request, { maxBytes: MAX_BODY_SIZE });

  if (!readResult.ok) {
    return {
      error: createErrorResponse({
        code: "invalid_request",
        message: bodyReadErrorMessage(readResult.reason),
      }),
      ok: false,
      status: readResult.status,
    };
  }

  const parsedBody = readResult.value;

  if (
    parsedBody === null ||
    typeof parsedBody !== "object" ||
    !("worldId" in parsedBody) ||
    typeof (parsedBody as Record<string, unknown>).worldId !== "string" ||
    !UUID_REGEX.test((parsedBody as Record<string, unknown>).worldId as string)
  ) {
    return {
      error: createErrorResponse({ code: "invalid_request", message: "worldId must be a UUID." }),
      ok: false,
      status: 400,
    };
  }

  return {
    body: { worldId: (parsedBody as Record<string, unknown>).worldId as string },
    ok: true,
  };
}

function bodyReadErrorMessage(reason: ReadCappedJsonBodyFailureReason): string {
  switch (reason) {
    case "invalid_content_type":
      return "Content-Type must be application/json.";
    case "body_too_large":
      return "Request body exceeds maximum size.";
    case "invalid_json":
      return "Request body must be JSON.";
  }
}
