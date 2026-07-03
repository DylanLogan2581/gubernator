import { readCappedJsonBody } from "../_shared/http/body.ts";


import { createErrorResponse } from "./http.ts";
import { isRecord } from "./utils.ts";

import type { EndTurnSimulationErrorResponse, EndTurnSimulationRequestBody } from "./types.ts";
import type { ReadCappedJsonBodyFailureReason } from "../_shared/http/body.ts";

const expectedRequestFields = [
  "expectedTurnNumber",
  "preview",
  "worldId",
] as const;

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_BODY_SIZE = 1024 * 10; // 10 KB

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
    readonly status: number;
  }
> {
  const readResult = await readCappedJsonBody(request, { maxBytes: MAX_BODY_SIZE });

  if (!readResult.ok) {
    return {
      error: createErrorResponse({
        code: "invalid_request",
        details: ["body"],
        message: bodyReadErrorMessage(readResult.reason),
      }),
      ok: false,
      status: readResult.status,
    };
  }

  const bodyShapeResult = parseEndTurnSimulationRequestBodyShape(readResult.value);

  if (!bodyShapeResult.ok) {
    return {
      error: createErrorResponse({
        code: "invalid_request",
        details: bodyShapeResult.validationErrors,
        message: "Request body must include worldId and expectedTurnNumber.",
      }),
      ok: false,
      status: 400,
    };
  }

  return {
    body: {
      expectedTurnNumber: bodyShapeResult.body.expectedTurnNumber,
      worldId: bodyShapeResult.body.worldId.trim(),
      preview: bodyShapeResult.body.preview === true,
    },
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
      return "Request body must be valid JSON.";
  }
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

  if (body.preview !== undefined && typeof body.preview !== "boolean") {
    validationErrors.push("preview");
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
    body.expectedTurnNumber >= 0 &&
    (body.preview === undefined || typeof body.preview === "boolean")
  );
}

function hasOnlyExpectedFields(
  body: Record<string, unknown>,
  expectedFields: readonly string[],
): boolean {
  return Object.keys(body).every((fieldName) =>
    expectedFields.some((expectedField) => expectedField === fieldName)
  );
}
