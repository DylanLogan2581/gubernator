import { createErrorResponse } from "./http.ts";

import type {
  AdminCreateUserErrorResponse,
  AdminCreateUserRequestBody,
} from "./types.ts";

type ValidateResult =
  | { readonly body: AdminCreateUserRequestBody; readonly ok: true }
  | { readonly error: AdminCreateUserErrorResponse; readonly ok: false };

// Input bounds
const MAX_EMAIL_LENGTH = 254;
const MAX_USERNAME_LENGTH = 64;
const MAX_PASSWORD_LENGTH = 128;
const MAX_BODY_SIZE = 1024 * 10; // 10 KB

// Expected top-level fields in the request
const EXPECTED_FIELDS = new Set([
  "email",
  "username",
  "password",
  "sendMagicLink",
]);

export function validateContentType(request: Request): ValidateResult | null {
  const contentType = request.headers.get("content-type");
  if (contentType === null || !contentType.includes("application/json")) {
    return {
      error: createErrorResponse({
        code: "invalid_request",
        message: "Content-Type must be application/json.",
      }),
      ok: false,
    };
  }
  return null;
}

export async function parseAdminCreateUserRequestBody(
  request: Request,
): Promise<ValidateResult> {
  // Check Content-Type
  const contentTypeError = validateContentType(request);
  if (contentTypeError !== null) {
    return contentTypeError;
  }

  // Check body size
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const size = parseInt(contentLength, 10);
    if (size > MAX_BODY_SIZE) {
      return {
        error: createErrorResponse({
          code: "invalid_request",
          message: "Request body exceeds maximum size.",
        }),
        ok: false,
      };
    }
  }

  let raw: unknown;

  try {
    raw = await request.json();
  } catch {
    return {
      error: createErrorResponse({
        code: "invalid_request",
        message: "Request body must be valid JSON.",
      }),
      ok: false,
    };
  }

  if (typeof raw !== "object" || raw === null) {
    return {
      error: createErrorResponse({
        code: "invalid_request",
        message: "Request body must be a JSON object.",
      }),
      ok: false,
    };
  }

  const obj = raw as Record<string, unknown>;

  // Check for unknown fields
  for (const key of Object.keys(obj)) {
    if (!EXPECTED_FIELDS.has(key)) {
      return {
        error: createErrorResponse({
          code: "invalid_request",
          message: "Request contains unknown fields.",
        }),
        ok: false,
      };
    }
  }

  const email =
    typeof obj["email"] === "string" ? obj["email"].trim() : undefined;
  const username =
    typeof obj["username"] === "string" ? obj["username"].trim() : undefined;
  const password =
    typeof obj["password"] === "string" ? obj["password"] : undefined;
  const sendMagicLink =
    typeof obj["sendMagicLink"] === "boolean"
      ? obj["sendMagicLink"]
      : undefined;

  if (email === undefined || email.length === 0 || !isValidEmail(email)) {
    return {
      error: createErrorResponse({
        code: "invalid_request",
        message: "A valid email address is required.",
      }),
      ok: false,
    };
  }

  if (email.length > MAX_EMAIL_LENGTH) {
    return {
      error: createErrorResponse({
        code: "invalid_request",
        message: "Email address exceeds maximum length.",
      }),
      ok: false,
    };
  }

  if (username === undefined || username.length === 0) {
    return {
      error: createErrorResponse({
        code: "invalid_request",
        message: "A username is required.",
      }),
      ok: false,
    };
  }

  if (username.length > MAX_USERNAME_LENGTH) {
    return {
      error: createErrorResponse({
        code: "invalid_request",
        message: "Username exceeds maximum length.",
      }),
      ok: false,
    };
  }

  if (
    sendMagicLink !== true &&
    (password === undefined || password.length < 8)
  ) {
    return {
      error: createErrorResponse({
        code: "invalid_request",
        message:
          "A password of at least 8 characters is required when not using magic link.",
      }),
      ok: false,
    };
  }

  if (password !== undefined && password.length > MAX_PASSWORD_LENGTH) {
    return {
      error: createErrorResponse({
        code: "invalid_request",
        message: "Password exceeds maximum length.",
      }),
      ok: false,
    };
  }

  return {
    body: { email, password, sendMagicLink, username },
    ok: true,
  };
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
