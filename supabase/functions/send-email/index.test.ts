import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { sendSmtpBatch } from "../_shared/smtp.ts";

import { handleSendEmailRequest } from "./index.ts";

import type { SendEmailResponse } from "./types.ts";

vi.mock("../_shared/smtp.ts", () => ({
  sendSmtpBatch: vi.fn(),
}));

const SUPABASE_URL = "https://project.supabase.co";
const SUPABASE_ANON_KEY = "anon-key";
const SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

const mockFetch = vi.fn();
const mockSendSmtpBatch = vi.mocked(sendSmtpBatch);

function makeRequest(body?: unknown, headers?: Record<string, string>): Request {
  return new Request("https://edge.supabase.co/functions/v1/send-email", {
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: {
      authorization: "Bearer valid-token",
      "content-type": "application/json",
      ...headers,
    },
    method: "POST",
  });
}

async function parseResponse(response: Response): Promise<SendEmailResponse> {
  return (await response.json()) as SendEmailResponse;
}

function setupMockFetch(
  responses: Record<string, { status: number; body: unknown } | Error>,
): void {
  const withDefaults: Record<string, { status: number; body: unknown } | Error> = {
    "rest/v1/email_send_log": { body: [{ id: "log-1" }], status: 201 },
    "rest/v1/smtp_settings?select=": { body: [], status: 200 },
    "rpc/increment_rate_limit_bucket": { body: 1, status: 200 },
    ...responses,
  };

  mockFetch.mockImplementation((url: string) => {
    for (const [pattern, response] of Object.entries(withDefaults)) {
      if (url.includes(pattern)) {
        if (response instanceof Error) {
          return Promise.reject(response);
        }
        return Promise.resolve(
          new Response(JSON.stringify(response.body), { status: response.status }),
        );
      }
    }
    return Promise.resolve(new Response(JSON.stringify({ error: "Not found" }), { status: 404 }));
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  vi.stubGlobal("Deno", {
    env: {
      get: (key: string) =>
        ({
          SEND_EMAIL_SMTP_ADMIN_EMAIL: "noreply@gubernator.local",
          SEND_EMAIL_SMTP_HOST: "inbucket",
          SEND_EMAIL_SMTP_PORT: "1025",
          SEND_EMAIL_SMTP_SENDER_NAME: "Gubernator",
          SUPABASE_ANON_KEY,
          SUPABASE_SERVICE_ROLE_KEY,
          SUPABASE_URL,
        })[key],
    },
  });
  mockSendSmtpBatch.mockImplementation((_config, messages) =>
    Promise.resolve(messages.map((message) => ({ ok: true, toEmail: message.toEmail }))),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("error: unauthenticated", () => {
  it("returns 401 when the authorization header is missing", async () => {
    const request = makeRequest({ kind: "test" }, { authorization: "" });
    const response = await handleSendEmailRequest(request);
    const body = await parseResponse(response);

    expect(response.status).toBe(401);
    expect(body.ok).toBe(false);
    if (!body.ok) {
      expect(body.error.code).toBe("unauthenticated");
    }
  });
});

describe("error: superadmin_required", () => {
  it("returns 403 when the caller is not a superadmin", async () => {
    setupMockFetch({
      "auth/v1/user": { body: { id: "user-123" }, status: 200 },
      "rest/v1/rpc/is_super_admin": { body: false, status: 200 },
    });

    const request = makeRequest({ kind: "test" });
    const response = await handleSendEmailRequest(request);
    const body = await parseResponse(response);

    expect(response.status).toBe(403);
    expect(body.ok).toBe(false);
    if (!body.ok) {
      expect(body.error.code).toBe("superadmin_required");
    }
    expect(mockSendSmtpBatch).not.toHaveBeenCalled();
  });
});

describe("error: rate_limit_exceeded", () => {
  it("returns 429 with a retry-after header when the rate limit is exceeded", async () => {
    setupMockFetch({
      "auth/v1/user": { body: { id: "user-123" }, status: 200 },
      "rest/v1/rpc/is_super_admin": { body: true, status: 200 },
      "rpc/increment_rate_limit_bucket": { body: 11, status: 200 },
    });

    const request = makeRequest({ kind: "test" });
    const response = await handleSendEmailRequest(request);
    const body = await parseResponse(response);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).not.toBeNull();
    expect(body.ok).toBe(false);
    if (!body.ok) {
      expect(body.error.code).toBe("rate_limit_exceeded");
    }
  });
});

describe("error: method_not_allowed", () => {
  it("returns 405 for unsupported methods", async () => {
    const request = new Request("https://edge.supabase.co/functions/v1/send-email", {
      method: "DELETE",
    });
    const response = await handleSendEmailRequest(request);
    expect(response.status).toBe(405);
  });
});

describe("GET: SMTP status", () => {
  it("returns SMTP status (no secrets) for a superadmin", async () => {
    setupMockFetch({
      "auth/v1/user": { body: { id: "user-123" }, status: 200 },
      "rest/v1/rpc/is_super_admin": { body: true, status: 200 },
    });

    const request = new Request("https://edge.supabase.co/functions/v1/send-email", {
      headers: { authorization: "Bearer valid-token" },
      method: "GET",
    });
    const response = await handleSendEmailRequest(request);
    const body = (await response.json()) as {
      ok: boolean;
      data?: {
        configured: boolean;
        source: string;
        host: string;
        port: number;
        hasPassword: boolean;
        senderName: string;
        adminEmail: string;
      };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({
      adminEmail: "noreply@gubernator.local",
      configured: true,
      hasPassword: false,
      host: "inbucket",
      port: 1025,
      senderName: "Gubernator",
      source: "environment",
    });
  });

  it("returns 200 with configured: false and the missing var names when SMTP env vars are absent", async () => {
    setupMockFetch({
      "auth/v1/user": { body: { id: "user-123" }, status: 200 },
      "rest/v1/rpc/is_super_admin": { body: true, status: 200 },
    });
    vi.stubGlobal("Deno", {
      env: {
        get: (key: string) =>
          ({
            SUPABASE_ANON_KEY,
            SUPABASE_SERVICE_ROLE_KEY,
            SUPABASE_URL,
          })[key],
      },
    });

    const request = new Request("https://edge.supabase.co/functions/v1/send-email", {
      headers: { authorization: "Bearer valid-token" },
      method: "GET",
    });
    const response = await handleSendEmailRequest(request);
    const body = (await response.json()) as {
      ok: boolean;
      data?: { configured: boolean; missing: string[] };
    };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.data?.configured).toBe(false);
    expect(body.data?.missing).toEqual([
      "SEND_EMAIL_SMTP_HOST",
      "SEND_EMAIL_SMTP_PORT",
      "SEND_EMAIL_SMTP_ADMIN_EMAIL",
      "SEND_EMAIL_SMTP_SENDER_NAME",
    ]);
  });

  it("returns 403 for a non-superadmin", async () => {
    setupMockFetch({
      "auth/v1/user": { body: { id: "user-123" }, status: 200 },
      "rest/v1/rpc/is_super_admin": { body: false, status: 200 },
    });

    const request = new Request("https://edge.supabase.co/functions/v1/send-email", {
      headers: { authorization: "Bearer valid-token" },
      method: "GET",
    });
    const response = await handleSendEmailRequest(request);

    expect(response.status).toBe(403);
  });

  it("reports source: database and hasPassword: true when a settings row is saved", async () => {
    setupMockFetch({
      "auth/v1/user": { body: { id: "user-123" }, status: 200 },
      "rest/v1/rpc/is_super_admin": { body: true, status: 200 },
      "rest/v1/smtp_settings?select=": {
        body: [
          {
            admin_email: "db-admin@example.com",
            host: "db-host",
            password: "db-secret-pass",
            port: 2525,
            sender_name: "DB Sender",
            username: "db-user",
          },
        ],
        status: 200,
      },
    });

    const request = new Request("https://edge.supabase.co/functions/v1/send-email", {
      headers: { authorization: "Bearer valid-token" },
      method: "GET",
    });
    const response = await handleSendEmailRequest(request);
    const responseText = await response.text();
    const body = JSON.parse(responseText) as {
      ok: boolean;
      data?: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      adminEmail: "db-admin@example.com",
      configured: true,
      hasPassword: true,
      host: "db-host",
      port: 2525,
      senderName: "DB Sender",
      source: "database",
      username: "db-user",
    });
    // The password must never appear anywhere in the response payload.
    expect(responseText).not.toContain("db-secret-pass");
  });
});

describe("POST: update_smtp_settings", () => {
  function makeUpdateRequest(overrides: Record<string, unknown> = {}): Request {
    return makeRequest({
      action: "update_smtp_settings",
      adminEmail: "noreply@gubernator.local",
      host: "smtp.example.com",
      port: 587,
      senderName: "Gubernator",
      username: "smtp-user",
      password: "smtp-pass",
      ...overrides,
    });
  }

  it("returns 403 when the caller is not a superadmin", async () => {
    setupMockFetch({
      "auth/v1/user": { body: { id: "user-123" }, status: 200 },
      "rest/v1/rpc/is_super_admin": { body: false, status: 200 },
    });

    const response = await handleSendEmailRequest(makeUpdateRequest());
    const body = await parseResponse(response);

    expect(response.status).toBe(403);
    if (!body.ok) {
      expect(body.error.code).toBe("superadmin_required");
    }
  });

  it("returns 400 for an invalid port", async () => {
    setupMockFetch({
      "auth/v1/user": { body: { id: "user-123" }, status: 200 },
      "rest/v1/rpc/is_super_admin": { body: true, status: 200 },
    });

    const response = await handleSendEmailRequest(makeUpdateRequest({ port: 70000 }));
    const body = await parseResponse(response);

    expect(response.status).toBe(400);
    if (!body.ok) {
      expect(body.error.code).toBe("invalid_request");
    }
  });

  it("returns 400 for an invalid admin email", async () => {
    setupMockFetch({
      "auth/v1/user": { body: { id: "user-123" }, status: 200 },
      "rest/v1/rpc/is_super_admin": { body: true, status: 200 },
    });

    const response = await handleSendEmailRequest(
      makeUpdateRequest({ adminEmail: "not-an-email" }),
    );

    expect(response.status).toBe(400);
  });

  it("upserts the row with the caller as updated_by on success", async () => {
    setupMockFetch({
      "auth/v1/user": { body: { id: "user-123" }, status: 200 },
      "rest/v1/rpc/is_super_admin": { body: true, status: 200 },
      "rest/v1/smtp_settings?on_conflict=id": { body: [{ id: true }], status: 201 },
    });

    const response = await handleSendEmailRequest(makeUpdateRequest());
    const body = await parseResponse(response);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);

    const upsertCall = mockFetch.mock.calls.find((call: unknown[]) =>
      typeof call[0] === "string" && call[0].includes("rest/v1/smtp_settings?on_conflict=id"));
    expect(upsertCall).toBeDefined();
    const upsertRequestInit = upsertCall?.[1] as { body: string };
    const upsertBody = JSON.parse(upsertRequestInit.body) as {
      host: string;
      port: number;
      username: string;
      password: string;
      admin_email: string;
      sender_name: string;
      updated_by: string;
    };
    expect(upsertBody.host).toBe("smtp.example.com");
    expect(upsertBody.port).toBe(587);
    expect(upsertBody.username).toBe("smtp-user");
    expect(upsertBody.password).toBe("smtp-pass");
    expect(upsertBody.admin_email).toBe("noreply@gubernator.local");
    expect(upsertBody.sender_name).toBe("Gubernator");
    expect(upsertBody.updated_by).toBe("user-123");
  });

  it("preserves the stored password when the password field is blank", async () => {
    setupMockFetch({
      "auth/v1/user": { body: { id: "user-123" }, status: 200 },
      "rest/v1/rpc/is_super_admin": { body: true, status: 200 },
      "rest/v1/smtp_settings?select=": {
        body: [
          {
            admin_email: "old@example.com",
            host: "old-host",
            password: "existing-secret",
            port: 25,
            sender_name: "Old Sender",
            username: "old-user",
          },
        ],
        status: 200,
      },
      "rest/v1/smtp_settings?on_conflict=id": { body: [{ id: true }], status: 201 },
    });

    const response = await handleSendEmailRequest(makeUpdateRequest({ password: "" }));
    expect(response.status).toBe(200);

    const upsertCall = mockFetch.mock.calls.find((call: unknown[]) =>
      typeof call[0] === "string" && call[0].includes("rest/v1/smtp_settings?on_conflict=id"));
    const upsertRequestInit = upsertCall?.[1] as { body: string };
    const upsertBody = JSON.parse(upsertRequestInit.body) as { password: string };
    expect(upsertBody.password).toBe("existing-secret");
  });
});

describe("error: invalid_request", () => {
  it("returns 400 for an invalid kind", async () => {
    setupMockFetch({});
    const request = makeRequest({ kind: "bogus" });
    const response = await handleSendEmailRequest(request);
    const body = await parseResponse(response);

    expect(response.status).toBe(400);
    if (!body.ok) {
      expect(body.error.code).toBe("invalid_request");
    }
  });

  it("returns 400 when subject/message are missing for a non-test kind", async () => {
    setupMockFetch({});
    const request = makeRequest({ kind: "all" });
    const response = await handleSendEmailRequest(request);
    expect(response.status).toBe(400);
  });
});

describe("success: test email", () => {
  it("sends a single email to the caller's own account", async () => {
    setupMockFetch({
      "auth/v1/user": { body: { id: "user-123" }, status: 200 },
      "rest/v1/rpc/is_super_admin": { body: true, status: 200 },
      "rest/v1/users?select=id,email&id=eq.user-123": {
        body: [{ email: "super-admin@example.com", id: "user-123" }],
        status: 200,
      },
    });

    const request = makeRequest({ kind: "test" });
    const response = await handleSendEmailRequest(request);
    const body = await parseResponse(response);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    if (body.ok) {
      expect(body.data.recipientCount).toBe(1);
      expect(body.data.sentCount).toBe(1);
      expect(body.data.failedCount).toBe(0);
    }
    expect(mockSendSmtpBatch).toHaveBeenCalledTimes(1);
    const [, messages] = mockSendSmtpBatch.mock.calls[0];
    expect(messages).toHaveLength(1);
    expect(messages[0].toEmail).toBe("super-admin@example.com");
  });
});

describe("success: dry run", () => {
  it("renders the email without sending or writing an audit row", async () => {
    setupMockFetch({
      "auth/v1/user": { body: { id: "user-123" }, status: 200 },
      "rest/v1/rpc/is_super_admin": { body: true, status: 200 },
      "rest/v1/users?select=id,email&status=eq.active&id=in.": {
        body: [{ email: "a@example.com", id: "user-a" }],
        status: 200,
      },
    });

    const request = makeRequest({
      dryRun: true,
      kind: "specific",
      message: "Hello there",
      subject: "Preview subject",
      userIds: ["11111111-1111-1111-1111-111111111111"],
    });
    const response = await handleSendEmailRequest(request);
    const body = await parseResponse(response);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    if (body.ok) {
      expect(body.data.renderedHtml).toContain("Preview subject");
      expect(body.data.renderedHtml).toContain("Hello there");
      expect(body.data.sentCount).toBe(0);
    }
    expect(mockSendSmtpBatch).not.toHaveBeenCalled();
  });
});

describe("error: no_recipients", () => {
  it("returns 404 when the specific user ids resolve to no active users", async () => {
    setupMockFetch({
      "auth/v1/user": { body: { id: "user-123" }, status: 200 },
      "rest/v1/rpc/is_super_admin": { body: true, status: 200 },
      "rest/v1/users?select=id,email&status=eq.active&id=in.": { body: [], status: 200 },
    });

    const request = makeRequest({
      kind: "specific",
      message: "Hello",
      subject: "Subject",
      userIds: ["11111111-1111-1111-1111-111111111111"],
    });
    const response = await handleSendEmailRequest(request);
    const body = await parseResponse(response);

    expect(response.status).toBe(404);
    if (!body.ok) {
      expect(body.error.code).toBe("no_recipients");
    }
    expect(mockSendSmtpBatch).not.toHaveBeenCalled();
  });
});

describe("success: manual notification to specific users", () => {
  it("sends and writes an audit log row", async () => {
    setupMockFetch({
      "auth/v1/user": { body: { id: "user-123" }, status: 200 },
      "rest/v1/rpc/is_super_admin": { body: true, status: 200 },
      "rest/v1/users?select=id,email&status=eq.active&id=in.": {
        body: [
          { email: "a@example.com", id: "11111111-1111-1111-1111-111111111111" },
          { email: "b@example.com", id: "22222222-2222-2222-2222-222222222222" },
        ],
        status: 200,
      },
    });

    const request = makeRequest({
      kind: "specific",
      message: "Hello team",
      subject: "Announcement",
      userIds: [
        "11111111-1111-1111-1111-111111111111",
        "22222222-2222-2222-2222-222222222222",
      ],
    });
    const response = await handleSendEmailRequest(request);
    const body = await parseResponse(response);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    if (body.ok) {
      expect(body.data.recipientCount).toBe(2);
      expect(body.data.sentCount).toBe(2);
    }

    const auditLogCall = mockFetch.mock.calls.find((call: unknown[]) =>
      typeof call[0] === "string" && call[0].includes("rest/v1/email_send_log"));
    expect(auditLogCall).toBeDefined();
    const auditLogRequestInit = auditLogCall?.[1] as { body: string };
    const auditLogBody = JSON.parse(auditLogRequestInit.body) as {
      recipient_count: number;
      subject: string;
    };
    expect(auditLogBody.recipient_count).toBe(2);
    expect(auditLogBody.subject).toBe("Announcement");
  });
});


describe("success: manual notification to world members", () => {
  it("reaches exactly the active player characters' users in that world", async () => {
    setupMockFetch({
      "auth/v1/user": { body: { id: "user-123" }, status: 200 },
      "rest/v1/citizens?select=user_id&world_id=eq.11111111-1111-1111-1111-111111111111": {
        body: [
          { user_id: "22222222-2222-2222-2222-222222222222" },
          { user_id: "33333333-3333-3333-3333-333333333333" },
          // Duplicate user_id (same user with multiple player characters in
          // the world) must be de-duplicated to a single recipient.
          { user_id: "22222222-2222-2222-2222-222222222222" },
        ],
        status: 200,
      },
      "rest/v1/rpc/is_super_admin": { body: true, status: 200 },
      "rest/v1/users?select=id,email&status=eq.active&id=in.": {
        body: [
          { email: "b@example.com", id: "22222222-2222-2222-2222-222222222222" },
          { email: "c@example.com", id: "33333333-3333-3333-3333-333333333333" },
        ],
        status: 200,
      },
    });

    const request = makeRequest({
      kind: "world",
      message: "Hello world",
      subject: "World announcement",
      worldId: "11111111-1111-1111-1111-111111111111",
    });
    const response = await handleSendEmailRequest(request);
    const body = await parseResponse(response);

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    if (body.ok) {
      expect(body.data.recipientCount).toBe(2);
      expect(body.data.sentCount).toBe(2);
    }
    expect(mockSendSmtpBatch).toHaveBeenCalledTimes(1);
    const [, messages] = mockSendSmtpBatch.mock.calls[0];
    expect(messages.map((message) => message.toEmail).sort()).toEqual([
      "b@example.com",
      "c@example.com",
    ]);

    const auditLogCall = mockFetch.mock.calls.find((call: unknown[]) =>
      typeof call[0] === "string" && call[0].includes("rest/v1/email_send_log"));
    const auditLogRequestInit = auditLogCall?.[1] as { body: string };
    const auditLogBody = JSON.parse(auditLogRequestInit.body) as {
      recipient_count: number;
      recipient_spec: { kind: string; worldId: string };
    };
    expect(auditLogBody.recipient_count).toBe(2);
    expect(auditLogBody.recipient_spec).toEqual({
      kind: "world",
      worldId: "11111111-1111-1111-1111-111111111111",
    });
  });
});

describe("CORS", () => {
  it("returns 403 origin_not_allowed for a disallowed browser origin", async () => {
    const request = makeRequest({ kind: "test" }, { origin: "https://evil.example.com" });
    const response = await handleSendEmailRequest(request, {
      allowedOrigins: ["https://app.example.com"],
    });
    const body = await parseResponse(response);

    expect(response.status).toBe(403);
    if (!body.ok) {
      expect(body.error.code).toBe("origin_not_allowed");
    }
  });

  it("responds to OPTIONS preflight with 204", async () => {
    const request = new Request("https://edge.supabase.co/functions/v1/send-email", {
      headers: { origin: "https://app.example.com" },
      method: "OPTIONS",
    });
    const response = await handleSendEmailRequest(request, {
      allowedOrigins: ["https://app.example.com"],
    });

    expect(response.status).toBe(204);
  });
});
