import { createErrorResponse } from "./http.ts";
import { isRecord } from "./utils.ts";

import type {
  EndTurnSimulationErrorResponse,
  EndTurnSimulationRequestBody,
} from "./types.ts";

const expectedRequestFields = ["expectedTurnNumber", "worldId"] as const;

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

  if (typeof body.worldId !== "string" || body.worldId.trim().length === 0) {
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
    body.worldId.trim().length > 0 &&
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
