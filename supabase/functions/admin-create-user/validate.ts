import { createErrorResponse } from "./http.ts";

import type {
  AdminCreateUserErrorResponse,
  AdminCreateUserRequestBody,
} from "./types.ts";

type ValidateResult =
  | { readonly body: AdminCreateUserRequestBody; readonly ok: true }
  | { readonly error: AdminCreateUserErrorResponse; readonly ok: false };

export async function parseAdminCreateUserRequestBody(
  request: Request,
): Promise<ValidateResult> {
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

  if (username === undefined || username.length === 0) {
    return {
      error: createErrorResponse({
        code: "invalid_request",
        message: "A username is required.",
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

  return {
    body: { email, password, sendMagicLink, username },
    ok: true,
  };
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
