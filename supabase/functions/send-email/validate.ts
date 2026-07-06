import { readCappedJsonBody } from "../_shared/http/body.ts";

import { createErrorResponse } from "./http.ts";

import type { SendEmailErrorResponse, SendEmailKind, SendEmailRequestBody } from "./types.ts";
import type { ReadCappedJsonBodyFailureReason } from "../_shared/http/body.ts";

type ValidateResult =
  | { readonly body: SendEmailRequestBody; readonly ok: true }
  | { readonly error: SendEmailErrorResponse; readonly ok: false; readonly status: number };

const MAX_SUBJECT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 5000;
const MAX_USER_IDS = 500;
const MAX_BODY_SIZE = 1024 * 64; // 64 KB (message body + up to 500 recipient ids)

const EXPECTED_FIELDS = new Set([
  "kind",
  "subject",
  "message",
  "userIds",
  "worldId",
  "nationId",
  "dryRun",
]);

const VALID_KINDS: readonly SendEmailKind[] = ["all", "nation", "specific", "test", "world"];

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

function invalidRequest(message: string): ValidateResult {
  return {
    error: createErrorResponse({ code: "invalid_request", message }),
    ok: false,
    status: 400,
  };
}

export async function parseSendEmailRequestBody(request: Request): Promise<ValidateResult> {
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

  const raw = readResult.value;

  if (typeof raw !== "object" || raw === null) {
    return invalidRequest("Request body must be a JSON object.");
  }

  const obj = raw as Record<string, unknown>;

  for (const key of Object.keys(obj)) {
    if (!EXPECTED_FIELDS.has(key)) {
      return invalidRequest("Request contains unknown fields.");
    }
  }

  const kind = typeof obj["kind"] === "string" ? obj["kind"] : undefined;
  if (kind === undefined || !VALID_KINDS.includes(kind as SendEmailKind)) {
    return invalidRequest("A valid kind is required (all, nation, specific, test, world).");
  }

  const dryRun = typeof obj["dryRun"] === "boolean" ? obj["dryRun"] : undefined;

  const subjectRaw = typeof obj["subject"] === "string" ? obj["subject"].trim() : undefined;
  const messageRaw = typeof obj["message"] === "string" ? obj["message"] : undefined;

  if (kind !== "test") {
    if (subjectRaw === undefined || subjectRaw.length === 0) {
      return invalidRequest("A subject is required.");
    }
    if (messageRaw === undefined || messageRaw.trim().length === 0) {
      return invalidRequest("A message is required.");
    }
  }

  if (subjectRaw !== undefined && subjectRaw.length > MAX_SUBJECT_LENGTH) {
    return invalidRequest(`Subject exceeds maximum length of ${MAX_SUBJECT_LENGTH} characters.`);
  }

  if (messageRaw !== undefined && messageRaw.length > MAX_MESSAGE_LENGTH) {
    return invalidRequest(`Message exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters.`);
  }

  let userIds: readonly string[] | undefined;
  if (kind === "specific") {
    if (!Array.isArray(obj["userIds"]) || obj["userIds"].length === 0) {
      return invalidRequest("userIds must be a non-empty array when kind is specific.");
    }
    if (obj["userIds"].length > MAX_USER_IDS) {
      return invalidRequest(`userIds cannot contain more than ${MAX_USER_IDS} entries.`);
    }
    if (!obj["userIds"].every((id) => typeof id === "string" && UUID_PATTERN.test(id))) {
      return invalidRequest("userIds must contain only valid user ids.");
    }
    userIds = obj["userIds"] as readonly string[];
  }

  let worldId: string | undefined;
  if (kind === "world") {
    if (typeof obj["worldId"] !== "string" || !UUID_PATTERN.test(obj["worldId"])) {
      return invalidRequest("A valid worldId is required when kind is world.");
    }
    worldId = obj["worldId"];
  }

  let nationId: string | undefined;
  if (kind === "nation") {
    if (typeof obj["nationId"] !== "string" || !UUID_PATTERN.test(obj["nationId"])) {
      return invalidRequest("A valid nationId is required when kind is nation.");
    }
    nationId = obj["nationId"];
  }

  return {
    body: {
      dryRun,
      kind: kind as SendEmailKind,
      message: messageRaw,
      nationId,
      subject: subjectRaw,
      userIds,
      worldId,
    },
    ok: true,
  };
}
