import { logAuthorizationDenial, logSendEmailSuccess } from "../_shared/auditLog.ts";
import {
  EDGE_COMMON_ENV_VAR_NAMES,
  EDGE_SEND_EMAIL_ENV_VAR_NAMES,
  EDGE_SERVICE_ROLE_ENV_VAR_NAMES,
} from "../_shared/envContract.ts";
import {
  assertEdgeEnvVars,
  getEdgeRuntime,
  getRequiredRuntimeEnv,
  getRequiredRuntimeUrl,
} from "../_shared/http/env.ts";
import { checkRateLimit, RATE_LIMITS } from "../_shared/http/rateLimit.ts";
import { createJsonResponse as createSharedJsonResponse } from "../_shared/http/response.ts";
import { sendSmtpBatch, type SmtpMessage } from "../_shared/smtp.ts";
import { classifyHttpError, supabaseFetch } from "../_shared/supabaseFetch.ts";

import {
  buildCorsHeaders,
  createErrorResponse,
  createJsonResponse,
  getAllowedOrigins,
} from "./http.ts";
import { fetchCallerRecipient, MAX_RECIPIENTS, resolveRecipients } from "./recipients.ts";
import { resolveSendEmailAuthContext } from "./session.ts";
import { type ResolvedSmtpConfig, resolveSmtpConfig, upsertSmtpSettings } from "./settings.ts";
import { renderEmailHtml, renderMessageBodyHtml } from "./template.ts";
import {
  parseSendEmailRequestBody,
  parseUpdateSmtpSettingsRequestBody,
  readSendEmailRequestJson,
} from "./validate.ts";

import type {
  EmailRecipient,
  SendEmailAnyResponse,
  SendEmailAuthContext,
  SendEmailHandlerOptions,
  SendEmailRequestBody,
  SendEmailStatusResponse,
} from "./types.ts";

export type {
  SendEmailAuthContext,
  SendEmailErrorCode,
  SendEmailErrorResponse,
  SendEmailHandlerOptions,
  SendEmailKind,
  SendEmailRequestBody,
  SendEmailResponse,
  SendEmailStatusResponse,
  SendEmailSuccessData,
  SendEmailSuccessResponse,
} from "./types.ts";

type CheckSuperAdminResult =
  | { readonly ok: true; readonly value: boolean }
  | { readonly ok: false };

const DEFAULT_TEST_SUBJECT = "Gubernator test email";
const DEFAULT_TEST_MESSAGE =
  "This is a test email from your Gubernator superadmin email tools. If you received this, SMTP is configured correctly.";

export async function handleSendEmailRequest(
  request: Request,
  options: SendEmailHandlerOptions = {},
): Promise<Response> {
  try {
    const allowedOrigins = options.allowedOrigins ?? getAllowedOrigins();
    const origin = request.headers.get("origin");

    // CORS allowlist is enforced for browser requests (those with an Origin
    // header). Requests without an Origin header bypass this check and
    // proceed to the JWT + superadmin checks, which are the actual access
    // boundary.
    if (origin !== null && !allowedOrigins.includes(origin)) {
      return createJsonResponse(
        createErrorResponse({ code: "origin_not_allowed", message: "Origin not allowed." }),
        403,
        null,
      );
    }

    const allowedOrigin = origin;
    const respond = (body: SendEmailAnyResponse, status: number): Response =>
      createJsonResponse(body, status, allowedOrigin);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: buildCorsHeaders(allowedOrigin), status: 204 });
    }

    if (request.method === "GET") {
      return handleSmtpStatusRequest(request, allowedOrigin);
    }

    if (request.method !== "POST") {
      return respond(
        createErrorResponse({ code: "method_not_allowed", message: "Use POST to send email." }),
        405,
      );
    }

    const rawBodyResult = await readSendEmailRequestJson(request);
    if (!rawBodyResult.ok) {
      return respond(rawBodyResult.error, rawBodyResult.status);
    }

    if (rawBodyResult.value["action"] === "update_smtp_settings") {
      return handleUpdateSmtpSettingsRequest(request, rawBodyResult.value, respond);
    }

    const validateResult = parseSendEmailRequestBody(rawBodyResult.value);
    if (!validateResult.ok) {
      return respond(validateResult.error, validateResult.status);
    }

    const authContextResult = await resolveSendEmailAuthContext(request);
    if (!authContextResult.ok) {
      return respond(authContextResult.error, authContextResult.status);
    }

    const superAdminResult = await checkIsSuperAdmin(authContextResult.context);
    if (!superAdminResult.ok || !superAdminResult.value) {
      logAuthorizationDenial(
        authContextResult.context.userId,
        validateResult.body.kind,
        "superadmin_required",
      );
      return respond(
        createErrorResponse({
          code: "superadmin_required",
          message: "Superadmin privileges are required to send email.",
        }),
        403,
      );
    }

    const rateLimitResult = await checkRateLimit(
      authContextResult.context.userId,
      "send-email",
      RATE_LIMITS["send-email"],
    );
    if (!rateLimitResult.ok) {
      const body = createErrorResponse({
        code: "rate_limit_exceeded",
        message: "Too many requests. Please wait before retrying.",
      });
      const res = respond(body, 429);
      const headers = new Headers(res.headers);
      headers.set("retry-after", String(rateLimitResult.retryAfterSeconds));
      return new Response(res.body, { headers, status: 429 });
    }

    const supabaseUrl = getRequiredRuntimeUrl("SUPABASE_URL");
    const serviceRoleKey = getRequiredRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY");
    if (supabaseUrl === undefined || serviceRoleKey === undefined) {
      return respond(
        createErrorResponse({
          code: "auth_context_unavailable",
          message: "Service role configuration is unavailable.",
        }),
        500,
      );
    }
    const serviceRoleConfig = { serviceRoleKey, supabaseUrl };

    const recipientsResult = await resolveRecipientsForRequest(
      serviceRoleConfig,
      validateResult.body,
      authContextResult.context.userId,
    );
    if (!recipientsResult.ok) {
      return respond(
        createErrorResponse({ code: recipientsResult.code, message: recipientsResult.message }),
        recipientsResult.code === "too_many_recipients" ? 422 : 404,
      );
    }

    const subject = validateResult.body.subject ?? DEFAULT_TEST_SUBJECT;
    const message = validateResult.body.message ?? DEFAULT_TEST_MESSAGE;
    const renderedHtml = renderEmailHtml({
      bodyHtml: renderMessageBodyHtml(message),
      subject,
    });

    if (validateResult.body.dryRun === true) {
      return respond(
        {
          data: {
            failedCount: 0,
            recipientCount: recipientsResult.recipients.length,
            renderedHtml,
            sentCount: 0,
            subject,
          },
          ok: true,
        },
        200,
      );
    }

    const smtpConfigResult = await resolveSmtpConfig(serviceRoleConfig, getEnvSmtpConfig);
    if (!smtpConfigResult.ok) {
      return respond(
        createErrorResponse({
          code: "smtp_config_unavailable",
          message: "SMTP configuration is unavailable.",
        }),
        500,
      );
    }

    const messages: SmtpMessage[] = recipientsResult.recipients.map((recipient) => ({
      fromEmail: smtpConfigResult.value.adminEmail,
      fromName: smtpConfigResult.value.senderName,
      html: renderedHtml,
      subject,
      toEmail: recipient.email,
    }));

    const sendResults = await sendSmtpBatch(smtpConfigResult.value, messages);
    const sentCount = sendResults.filter((result) => result.ok).length;
    const failedCount = sendResults.length - sentCount;

    await writeEmailSendLog(serviceRoleConfig, {
      recipientCount: recipientsResult.recipients.length,
      recipientSpec: buildRecipientSpec(validateResult.body),
      senderUserId: authContextResult.context.userId,
      subject,
    });

    logSendEmailSuccess(
      authContextResult.context.userId,
      validateResult.body.kind,
      recipientsResult.recipients.length,
      sentCount,
      failedCount,
    );

    return respond(
      {
        data: {
          failedCount,
          recipientCount: recipientsResult.recipients.length,
          sentCount,
          subject,
        },
        ok: true,
      },
      200,
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-restricted-syntax
    console.log(
      JSON.stringify({
        error: errorMessage,
        event: "unexpected_error",
        timestamp: new Date().toISOString(),
      }),
    );
    const allowedOrigin = request.headers.get("origin");
    const allowedOrigins = options.allowedOrigins ?? getAllowedOrigins();
    const safeAllowedOrigin = allowedOrigin !== null && allowedOrigins.includes(allowedOrigin)
      ? allowedOrigin
      : null;
    return createJsonResponse(
      createErrorResponse({ code: "send_email_error", message: "An unexpected error occurred." }),
      500,
      safeAllowedOrigin,
    );
  }
}

async function handleSmtpStatusRequest(
  request: Request,
  allowedOrigin: string | null,
): Promise<Response> {
  const respond = (body: SendEmailStatusResponse, status: number): Response =>
    createSharedJsonResponse(body, status, allowedOrigin);

  const authContextResult = await resolveSendEmailAuthContext(request);
  if (!authContextResult.ok) {
    return respond(authContextResult.error, authContextResult.status);
  }

  const superAdminResult = await checkIsSuperAdmin(authContextResult.context);
  if (!superAdminResult.ok || !superAdminResult.value) {
    logAuthorizationDenial(authContextResult.context.userId, "smtp_status", "superadmin_required");
    return respond(
      createErrorResponse({
        code: "superadmin_required",
        message: "Superadmin privileges are required to view SMTP status.",
      }),
      403,
    );
  }

  const supabaseUrl = getRequiredRuntimeUrl("SUPABASE_URL");
  const serviceRoleKey = getRequiredRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (supabaseUrl === undefined || serviceRoleKey === undefined) {
    return respond(
      createErrorResponse({
        code: "auth_context_unavailable",
        message: "Service role configuration is unavailable.",
      }),
      500,
    );
  }

  const smtpConfigResult = await resolveSmtpConfig(
    { serviceRoleKey, supabaseUrl },
    getEnvSmtpConfig,
  );
  if (!smtpConfigResult.ok) {
    // Missing SMTP env vars is a valid, expected state (not yet configured),
    // not a server error -- respond 200 so the client can render guidance
    // instead of a generic load failure.
    return respond(
      {
        data: { configured: false, missing: smtpConfigResult.missing },
        ok: true,
      },
      200,
    );
  }

  return respond(
    {
      data: {
        adminEmail: smtpConfigResult.value.adminEmail,
        configured: true,
        hasPassword: smtpConfigResult.value.pass !== undefined &&
          smtpConfigResult.value.pass !== "",
        host: smtpConfigResult.value.host,
        port: smtpConfigResult.value.port,
        senderName: smtpConfigResult.value.senderName,
        source: smtpConfigResult.value.source,
        username: smtpConfigResult.value.user,
      },
      ok: true,
    },
    200,
  );
}

async function handleUpdateSmtpSettingsRequest(
  request: Request,
  rawBody: Record<string, unknown>,
  respond: (body: SendEmailAnyResponse, status: number) => Response,
): Promise<Response> {
  const validateResult = parseUpdateSmtpSettingsRequestBody(rawBody);
  if (!validateResult.ok) {
    return respond(validateResult.error, validateResult.status);
  }

  const authContextResult = await resolveSendEmailAuthContext(request);
  if (!authContextResult.ok) {
    return respond(authContextResult.error, authContextResult.status);
  }

  const superAdminResult = await checkIsSuperAdmin(authContextResult.context);
  if (!superAdminResult.ok || !superAdminResult.value) {
    logAuthorizationDenial(
      authContextResult.context.userId,
      "update_smtp_settings",
      "superadmin_required",
    );
    return respond(
      createErrorResponse({
        code: "superadmin_required",
        message: "Superadmin privileges are required to update SMTP settings.",
      }),
      403,
    );
  }

  const supabaseUrl = getRequiredRuntimeUrl("SUPABASE_URL");
  const serviceRoleKey = getRequiredRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (supabaseUrl === undefined || serviceRoleKey === undefined) {
    return respond(
      createErrorResponse({
        code: "auth_context_unavailable",
        message: "Service role configuration is unavailable.",
      }),
      500,
    );
  }

  const upsertResult = await upsertSmtpSettings(
    { serviceRoleKey, supabaseUrl },
    validateResult.body,
    authContextResult.context.userId,
  );
  if (!upsertResult.ok) {
    return respond(
      createErrorResponse({
        code: "smtp_config_unavailable",
        message: "Saving SMTP settings failed.",
      }),
      500,
    );
  }

  return respond({ data: { updated: true }, ok: true }, 200);
}

async function checkIsSuperAdmin(
  authContext: SendEmailAuthContext,
): Promise<CheckSuperAdminResult> {
  const supabaseUrl = getRequiredRuntimeUrl("SUPABASE_URL");
  const supabaseAnonKey = getRequiredRuntimeEnv("SUPABASE_ANON_KEY");

  if (supabaseUrl === undefined || supabaseAnonKey === undefined) {
    return { ok: false };
  }

  let response: Response;
  try {
    response = await supabaseFetch(`${supabaseUrl}/rest/v1/rpc/is_super_admin`, {
      body: JSON.stringify({}),
      headers: {
        apikey: supabaseAnonKey,
        authorization: authContext.authorizationHeader,
        "content-type": "application/json",
      },
      method: "POST",
    });
  } catch {
    return { ok: false };
  }

  if (!response.ok) {
    const { safeDeny } = classifyHttpError(response.status);
    return safeDeny ? { ok: true, value: false } : { ok: false };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false };
  }

  if (typeof payload !== "boolean") {
    return { ok: false };
  }

  return { ok: true, value: payload };
}

type RecipientResolutionOutcome =
  | { readonly ok: true; readonly recipients: readonly EmailRecipient[] }
  | {
    readonly ok: false;
    readonly code: "no_recipients" | "recipient_resolution_failed" | "too_many_recipients";
    readonly message: string;
  };

async function resolveRecipientsForRequest(
  config: { readonly supabaseUrl: string; readonly serviceRoleKey: string },
  body: SendEmailRequestBody,
  callerUserId: string,
): Promise<RecipientResolutionOutcome> {
  if (body.kind === "test") {
    const caller = await fetchCallerRecipient(config, callerUserId);
    if (caller === null) {
      return {
        code: "recipient_resolution_failed",
        message: "Could not resolve your account's email address.",
        ok: false,
      };
    }
    return { ok: true, recipients: [caller] };
  }

  return resolveRecipients(config, body);
}

function buildRecipientSpec(body: SendEmailRequestBody): Record<string, unknown> {
  switch (body.kind) {
    case "specific":
      return { kind: "specific", userIds: body.userIds ?? [] };
    case "world":
      return { kind: "world", worldId: body.worldId };
    case "nation":
      return { kind: "nation", nationId: body.nationId };
    case "all":
      return { kind: "all" };
    case "test":
      return { kind: "test" };
  }
}

type EnvSmtpConfigResult =
  | { readonly ok: true; readonly value: Omit<ResolvedSmtpConfig, "source"> }
  | { readonly ok: false; readonly missing: readonly string[] };

function getEnvSmtpConfig(): EnvSmtpConfigResult {
  const host = getRequiredRuntimeEnv("SEND_EMAIL_SMTP_HOST");
  const portRaw = getRequiredRuntimeEnv("SEND_EMAIL_SMTP_PORT");
  const adminEmail = getRequiredRuntimeEnv("SEND_EMAIL_SMTP_ADMIN_EMAIL");
  const senderName = getRequiredRuntimeEnv("SEND_EMAIL_SMTP_SENDER_NAME");
  const user = getRequiredRuntimeEnv("SEND_EMAIL_SMTP_USER");
  const pass = getRequiredRuntimeEnv("SEND_EMAIL_SMTP_PASS");

  if (
    host === undefined || portRaw === undefined || adminEmail === undefined ||
    senderName === undefined
  ) {
    const missing: string[] = [];
    if (host === undefined) missing.push("SEND_EMAIL_SMTP_HOST");
    if (portRaw === undefined) missing.push("SEND_EMAIL_SMTP_PORT");
    if (adminEmail === undefined) missing.push("SEND_EMAIL_SMTP_ADMIN_EMAIL");
    if (senderName === undefined) missing.push("SEND_EMAIL_SMTP_SENDER_NAME");
    return { missing, ok: false };
  }

  const port = Number.parseInt(portRaw, 10);
  if (!Number.isFinite(port)) {
    return { missing: ["SEND_EMAIL_SMTP_PORT"], ok: false };
  }

  return { ok: true, value: { adminEmail, host, pass, port, senderName, user } };
}

async function writeEmailSendLog(
  config: { readonly supabaseUrl: string; readonly serviceRoleKey: string },
  entry: {
    readonly senderUserId: string;
    readonly recipientSpec: Record<string, unknown>;
    readonly subject: string;
    readonly recipientCount: number;
  },
): Promise<void> {
  try {
    await supabaseFetch(`${config.supabaseUrl}/rest/v1/email_send_log`, {
      body: JSON.stringify({
        recipient_count: entry.recipientCount,
        recipient_spec: entry.recipientSpec,
        sender_user_id: entry.senderUserId,
        subject: entry.subject,
      }),
      headers: {
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.serviceRoleKey}`,
        "content-type": "application/json",
      },
      method: "POST",
    });
  } catch (error) {
    // Audit log write failure should not block the response: the email was
    // already sent (or attempted). Log server-side for operator visibility.
    const errorMessage = error instanceof Error ? error.message : String(error);
    // eslint-disable-next-line no-restricted-syntax
    console.log(
      JSON.stringify({
        error: errorMessage,
        event: "email_send_log_write_error",
        timestamp: new Date().toISOString(),
      }),
    );
  }
}

export { MAX_RECIPIENTS };

assertEdgeEnvVars([
  ...EDGE_COMMON_ENV_VAR_NAMES,
  ...EDGE_SERVICE_ROLE_ENV_VAR_NAMES,
  ...EDGE_SEND_EMAIL_ENV_VAR_NAMES,
]);

const edgeRuntime = getEdgeRuntime();

if (edgeRuntime !== undefined) {
  edgeRuntime.serve(handleSendEmailRequest);
}
