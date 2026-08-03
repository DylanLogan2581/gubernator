export type SendEmailErrorPayload = {
  readonly ok: false;
  readonly error: { readonly code: string; readonly message: string };
};

export function isSendEmailErrorPayload(
  value: unknown,
): value is SendEmailErrorPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as { ok: unknown }).ok === false &&
    typeof (value as { error: unknown }).error === "object"
  );
}

/**
 * The send-email Edge Function reports failures as a 4xx/5xx response whose
 * body is a JSON error payload; supabase-js only exposes that body via the
 * error's `context` (a Response), so callers must read and parse it manually.
 */
export async function readSendEmailErrorPayload(
  error: unknown,
): Promise<SendEmailErrorPayload | null> {
  if (typeof error !== "object" || error === null || !("context" in error)) {
    return null;
  }

  const maybeContext = (error as Record<string, unknown>)["context"];
  if (typeof maybeContext !== "object" || maybeContext === null) {
    return null;
  }

  const context = maybeContext as Record<string, unknown>;
  if (typeof context["json"] !== "function") {
    return null;
  }

  try {
    const payload: unknown = await (
      context as { json: () => Promise<unknown> }
    ).json();
    if (isSendEmailErrorPayload(payload)) {
      return payload;
    }
  } catch {
    return null;
  }

  return null;
}
