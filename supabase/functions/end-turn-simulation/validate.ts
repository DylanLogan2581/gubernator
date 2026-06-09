import { createErrorResponse } from "./http.ts";
import { isRecord } from "./utils.ts";

import type {
  EndTurnSimulationErrorResponse,
  EndTurnSimulationRequestBody,
} from "./types.ts";

const expectedRequestFields = ["expectedTurnNumber", "worldId"] as const;

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_BODY_SIZE = 1024 * 10; // 10 KB

export function validateContentType(
  request: Request,
): EndTurnSimulationErrorResponse | null {
  const contentType = request.headers.get("content-type");
  if (contentType === null || !contentType.includes("application/json")) {
    return createErrorResponse({
      code: "invalid_request",
      details: ["body"],
      message: "Content-Type must be application/json.",
    });
  }
  return null;
}

export async function parseEndTurnSimulationRequestBody(
  request: Request,
): Promise<
  | {
      readonly body: EndTurnSimulationRequestBody;
      readonly ok: true;
    }
  | {
      readonly error: EndTurnSimulationErrorResponse;
      readonly ok: false;
    }
> {
  // Check Content-Type
  const contentTypeError = validateContentType(request);
  if (contentTypeError !== null) {
    return {
      error: contentTypeError,
      ok: false,
    };
  }

  // Check body size
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const size = parseInt(contentLength, 10);
    if (size > MAX_BODY_SIZE) {
      return {
        error: createErrorResponse({
          code: "invalid_request",
          details: ["body"],
          message: "Request body exceeds maximum size.",
        }),
        ok: false,
      };
    }
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return {
      error: createErrorResponse({
        code: "invalid_request",
        details: ["body"],
        message: "Request body must be valid JSON.",
      }),
      ok: false,
    };
  }

  const bodyShapeResult = parseEndTurnSimulationRequestBodyShape(body);

  if (!bodyShapeResult.ok) {
    return {
      error: createErrorResponse({
        code: "invalid_request",
        details: bodyShapeResult.validationErrors,
        message: "Request body must include worldId and expectedTurnNumber.",
      }),
      ok: false,
    };
  }

  return {
    body: {
      expectedTurnNumber: bodyShapeResult.body.expectedTurnNumber,
      worldId: bodyShapeResult.body.worldId.trim(),
    },
    ok: true,
  };
}

function parseEndTurnSimulationRequestBodyShape(body: unknown):
  | {
      readonly body: EndTurnSimulationRequestBody;
      readonly ok: true;
    }
  | {
      readonly ok: false;
      readonly validationErrors: readonly string[];
    } {
  const validationErrors = validateEndTurnSimulationRequestBody(body);

  if (validationErrors.length > 0 || !isEndTurnSimulationRequestBody(body)) {
    return {
      ok: false,
      validationErrors,
    };
  }

  return {
    body,
    ok: true,
  };
}

function validateEndTurnSimulationRequestBody(
  body: unknown,
): readonly string[] {
  if (!isRecord(body)) {
    return ["body"];
  }

  const validationErrors: string[] = [];

  if (!hasOnlyExpectedFields(body, expectedRequestFields)) {
    validationErrors.push("body");
  }

  if (
    typeof body.worldId !== "string" ||
    !UUID_REGEX.test(body.worldId.trim())
  ) {
    validationErrors.push("worldId");
  }

  if (
    typeof body.expectedTurnNumber !== "number" ||
    !Number.isSafeInteger(body.expectedTurnNumber) ||
    body.expectedTurnNumber < 0
  ) {
    validationErrors.push("expectedTurnNumber");
  }

  return validationErrors;
}

function isEndTurnSimulationRequestBody(
  body: unknown,
): body is EndTurnSimulationRequestBody {
  return (
    isRecord(body) &&
    hasOnlyExpectedFields(body, expectedRequestFields) &&
    typeof body.worldId === "string" &&
    UUID_REGEX.test(body.worldId.trim()) &&
    typeof body.expectedTurnNumber === "number" &&
    Number.isSafeInteger(body.expectedTurnNumber) &&
    body.expectedTurnNumber >= 0
  );
}

function hasOnlyExpectedFields(
  body: Record<string, unknown>,
  expectedFields: readonly string[],
): boolean {
  return Object.keys(body).every((fieldName) =>
    expectedFields.some((expectedField) => expectedField === fieldName),
  );
}
