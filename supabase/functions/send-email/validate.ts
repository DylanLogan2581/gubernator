import { readCappedJsonBody } from "../_shared/http/body.ts";

import { createErrorResponse } from "./http.ts";

import type {
  SendEmailErrorResponse,
  SendEmailKind,
  SendEmailRequestBody,
  UpdateSmtpSettingsRequestBody,
} from "./types.ts";
import type { ReadCappedJsonBodyFailureReason } from "../_shared/http/body.ts";

type ValidateResult =
  | { readonly body: SendEmailRequestBody; readonly ok: true }
  | { readonly error: SendEmailErrorResponse; readonly ok: false; readonly status: number };

type UpdateSmtpSettingsValidateResult =
  | { readonly body: UpdateSmtpSettingsRequestBody; readonly ok: true }
  | { readonly error: SendEmailErrorResponse; readonly ok: false; readonly status: number };

export type RawBodyResult =
  | { readonly ok: true; readonly value: Record<string, unknown> }
  | { readonly error: SendEmailErrorResponse; readonly ok: false; readonly status: number };

const MAX_SUBJECT_LENGTH = 200;
const MAX_MESSAGE_LENGTH = 5000;
const MAX_USER_IDS = 500;
const MAX_BODY_SIZE = 1024 * 64; // 64 KB (message body + up to 500 recipient ids)

const MAX_HOST_LENGTH = 255;
const MAX_SMTP_USERNAME_LENGTH = 200;
const MAX_SMTP_PASSWORD_LENGTH = 200;
const MAX_ADMIN_EMAIL_LENGTH = 254;
const MAX_SENDER_NAME_LENGTH = 200;

const EXPECTED_FIELDS = new Set([
  "kind",
  "subject",
  "message",
  "userIds",
  "worldId",
  "nationId",
  "dryRun",
]);

const EXPECTED_UPDATE_SMTP_SETTINGS_FIELDS = new Set([
  "action",
  "host",
  "port",
  "username",
  "password",
  "adminEmail",
  "senderName",
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

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Reads and JSON-parses the request body once. The caller inspects the
 * `action` field to decide which specific parser to run next, since the
 * body stream can only be consumed a single time.
 */
export async function readSendEmailRequestJson(request: Request): Promise<RawBodyResult> {
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
    return {
      error: createErrorResponse({
        code: "invalid_request",
        message: "Request body must be a JSON object.",
      }),
      ok: false,
      status: 400,
    };
  }

  return { ok: true, value: raw as Record<string, unknown> };
}

export function parseSendEmailRequestBody(obj: Record<string, unknown>): ValidateResult {
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

function invalidUpdateRequest(message: string): UpdateSmtpSettingsValidateResult {
  return {
    error: createErrorResponse({ code: "invalid_request", message }),
    ok: false,
    status: 400,
  };
}

export function parseUpdateSmtpSettingsRequestBody(
  obj: Record<string, unknown>,
): UpdateSmtpSettingsValidateResult {
  for (const key of Object.keys(obj)) {
    if (!EXPECTED_UPDATE_SMTP_SETTINGS_FIELDS.has(key)) {
      return invalidUpdateRequest("Request contains unknown fields.");
    }
  }

  const host = typeof obj["host"] === "string" ? obj["host"].trim() : undefined;
  if (host === undefined || host.length === 0) {
    return invalidUpdateRequest("A host is required.");
  }
  if (host.length > MAX_HOST_LENGTH) {
    return invalidUpdateRequest(`Host exceeds maximum length of ${MAX_HOST_LENGTH} characters.`);
  }

  const port = obj["port"];
  if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) {
    return invalidUpdateRequest("A valid port between 1 and 65535 is required.");
  }

  const username = typeof obj["username"] === "string" ? obj["username"].trim() : undefined;
  if (username !== undefined && username.length > MAX_SMTP_USERNAME_LENGTH) {
    return invalidUpdateRequest(
      `Username exceeds maximum length of ${MAX_SMTP_USERNAME_LENGTH} characters.`,
    );
  }

  const password = typeof obj["password"] === "string" ? obj["password"] : undefined;
  if (password !== undefined && password.length > MAX_SMTP_PASSWORD_LENGTH) {
    return invalidUpdateRequest(
      `Password exceeds maximum length of ${MAX_SMTP_PASSWORD_LENGTH} characters.`,
    );
  }

  const adminEmail = typeof obj["adminEmail"] === "string" ? obj["adminEmail"].trim() : undefined;
  if (adminEmail === undefined || adminEmail.length === 0 || !isValidEmail(adminEmail)) {
    return invalidUpdateRequest("A valid admin email address is required.");
  }
  if (adminEmail.length > MAX_ADMIN_EMAIL_LENGTH) {
    return invalidUpdateRequest("Admin email address exceeds maximum length.");
  }

  const senderName = typeof obj["senderName"] === "string" ? obj["senderName"].trim() : undefined;
  if (senderName === undefined || senderName.length === 0) {
    return invalidUpdateRequest("A sender name is required.");
  }
  if (senderName.length > MAX_SENDER_NAME_LENGTH) {
    return invalidUpdateRequest(
      `Sender name exceeds maximum length of ${MAX_SENDER_NAME_LENGTH} characters.`,
    );
  }

  return {
    body: {
      adminEmail,
      host,
      password,
      port,
      senderName,
      username,
    },
    ok: true,
  };
}
