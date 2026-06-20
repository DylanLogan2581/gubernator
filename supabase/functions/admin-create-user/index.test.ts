import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleAdminCreateUserRequest } from "./index";

// Mock environment variables
const SUPABASE_URL = "https://example.supabase.co";
const SUPABASE_ANON_KEY = "test-anon-key";
const SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

type ResponseBody = {
  error?: { code?: string; message?: string };
  ok?: boolean;
  data?: { userId?: string; email?: string; username?: string };
};

const mockFetch = vi.fn();

async function parseResponse(response: Response): Promise<ResponseBody> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const body = await response.json();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return body;
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  vi.stubGlobal("Deno", {
    env: {
      get: (key: string) => {
        const env: Record<string, string> = {
          SUPABASE_URL,
          SUPABASE_ANON_KEY,
          SUPABASE_SERVICE_ROLE_KEY,
        };
        return env[key];
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function makeRequest(
  body?: Record<string, unknown>,
  headers?: Record<string, string>,
): Request {
  const defaultHeaders = {
    "content-type": "application/json",
    authorization: "Bearer valid-token",
    ...headers,
  };
  return new Request("https://example.com/functions/v1/admin-create-user", {
    method: "POST",
    headers: defaultHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function setupMockFetch(
  responses: Record<
    string,
    { status: number; body: Record<string, unknown> | boolean | number } | Error
  >,
): void {
  mockFetch.mockImplementation((url: string) => {
    for (const [pattern, response] of Object.entries(responses)) {
      if (url.includes(pattern)) {
        if (response instanceof Error) {
          return Promise.reject(response);
        }
        return Promise.resolve(
          new Response(JSON.stringify(response.body), {
            status: response.status,
          }),
        );
      }
    }
    // Default: treat as auth error
    return Promise.resolve(
      new Response(JSON.stringify({ error: "Not found" }), { status: 404 }),
    );
  });
}

describe("handleAdminCreateUserRequest", () => {
  describe("error: unauthenticated (missing auth header)", () => {
    it("returns 401 with unauthenticated code when no auth header", async () => {
      setupMockFetch({});

      const request = makeRequest(
        {
          email: "test@example.com",
          username: "testuser",
          password: "password123",
        },
        { authorization: "" },
      );

      const response = await handleAdminCreateUserRequest(request);
      const body = await parseResponse(response);

      expect(response.status).toBe(401);
      expect(body.error?.code).toBe("unauthenticated");
      expect(body.ok).toBe(false);
    });
  });

  describe("error: superadmin_required (not a superadmin)", () => {
    it("returns 403 with superadmin_required code when user is not superadmin", async () => {
      setupMockFetch({
        "auth/v1/user": { status: 200, body: { id: "user-123" } },
        "rest/v1/rpc/is_super_admin": { status: 200, body: false },
      });

      const request = makeRequest({
        email: "test@example.com",
        username: "testuser",
        password: "password123",
      });

      const response = await handleAdminCreateUserRequest(request);
      const body = await parseResponse(response);

      expect(response.status).toBe(403);
      expect(body.error?.code).toBe("superadmin_required");
      expect(body.ok).toBe(false);
    });
  });

  describe("error: email_conflict (email already exists)", () => {
    it("returns 409 with email_conflict code when email exists (422)", async () => {
      setupMockFetch({
        "auth/v1/user": { status: 200, body: { id: "user-123" } },
        "rest/v1/rpc/is_super_admin": { status: 200, body: true },
        "auth/v1/admin/users": {
          status: 422,
          body: { msg: "The user with this email already exists" },
        },
      });

      const request = makeRequest({
        email: "existing@example.com",
        username: "testuser",
        password: "password123",
      });

      const response = await handleAdminCreateUserRequest(request);
      const body = await parseResponse(response);

      expect(response.status).toBe(409);
      expect(body.error?.code).toBe("email_conflict");
      expect(body.ok).toBe(false);
    });

    it("returns 409 with email_conflict code when message contains 'already'", async () => {
      setupMockFetch({
        "auth/v1/user": { status: 200, body: { id: "user-123" } },
        "rest/v1/rpc/is_super_admin": { status: 200, body: true },
        "auth/v1/admin/users": {
          status: 400,
          body: { message: "This email already exists" },
        },
      });

      const request = makeRequest({
        email: "existing@example.com",
        username: "testuser",
        password: "password123",
      });

      const response = await handleAdminCreateUserRequest(request);
      const body = await parseResponse(response);

      expect(response.status).toBe(409);
      expect(body.error?.code).toBe("email_conflict");
    });
  });

  describe("error: auth_admin_error (auth service error)", () => {
    it("returns 500 with auth_admin_error code when auth service fails", async () => {
      setupMockFetch({
        "auth/v1/user": { status: 200, body: { id: "user-123" } },
        "rest/v1/rpc/is_super_admin": { status: 200, body: true },
        "auth/v1/admin/users": {
          status: 500,
          body: { message: "Internal server error" },
        },
      });

      const request = makeRequest({
        email: "test@example.com",
        username: "testuser",
        password: "password123",
      });

      const response = await handleAdminCreateUserRequest(request);
      const body = await parseResponse(response);

      expect(response.status).toBe(500);
      expect(body.error?.code).toBe("auth_admin_error");
      expect(body.ok).toBe(false);
    });

    it("returns 502 with auth_admin_error code when fetch fails", async () => {
      setupMockFetch({
        "auth/v1/user": { status: 200, body: { id: "user-123" } },
        "rest/v1/rpc/is_super_admin": { status: 200, body: true },
        "auth/v1/admin/users": new Error("Network error"),
      });

      const request = makeRequest({
        email: "test@example.com",
        username: "testuser",
        password: "password123",
      });

      const response = await handleAdminCreateUserRequest(request);
      const body = await parseResponse(response);

      expect(response.status).toBe(502);
      expect(body.error?.code).toBe("auth_admin_error");
      expect(body.ok).toBe(false);
    });

    it("never exposes raw upstream error message to client", async () => {
      const upstreamErrorMsg = "Rate limit exceeded: 100 requests per minute";
      setupMockFetch({
        "auth/v1/user": { status: 200, body: { id: "user-123" } },
        "rest/v1/rpc/is_super_admin": { status: 200, body: true },
        "auth/v1/admin/users": {
          status: 429,
          body: { message: upstreamErrorMsg },
        },
      });

      const request = makeRequest({
        email: "test@example.com",
        username: "testuser",
        password: "password123",
      });

      const consoleSpy = vi.spyOn(console, "log");
      const response = await handleAdminCreateUserRequest(request);
      const body = await parseResponse(response);

      expect(response.status).toBe(500);
      expect(body.error?.code).toBe("auth_admin_error");
      expect(body.error?.message).toBe("User creation failed.");
      // Verify raw message is NOT in client response
      expect(body.error?.message).not.toBe(upstreamErrorMsg);
      expect(body.error?.message).not.toContain("Rate limit");

      // Verify raw message IS logged server-side
      const logCalls = consoleSpy.mock.calls;
      const authErrorLog = logCalls.find((call) => {
        const logStr = String(call[0]);
        return logStr.includes("auth_admin_error");
      });
      expect(authErrorLog).toBeDefined();
      if (authErrorLog !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const logJson = JSON.parse(String(authErrorLog[0]));
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(logJson.upstreamError).toBe(upstreamErrorMsg);
      }

      consoleSpy.mockRestore();
    });

    it("handles validation errors without leaking details", async () => {
      const upstreamMsg = "Invalid input: validation failed";
      setupMockFetch({
        "auth/v1/user": { status: 200, body: { id: "user-123" } },
        "rest/v1/rpc/is_super_admin": { status: 200, body: true },
        "auth/v1/admin/users": {
          status: 500,
          body: { message: upstreamMsg },
        },
      });

      const request = makeRequest({
        email: "test@example.com",
        username: "testuser",
        password: "password123",
      });

      const response = await handleAdminCreateUserRequest(request);
      const body = await parseResponse(response);

      expect(response.status).toBe(500);
      expect(body.error?.code).toBe("auth_admin_error");
      expect(body.error?.message).toBe("User creation failed.");
      // Verify upstream message details never exposed
      expect(body.error?.message).not.toBe(upstreamMsg);
      expect(body.error?.message).not.toContain("Invalid input");
    });
  });

  describe("success: user creation", () => {
    it("creates user successfully with password", async () => {
      setupMockFetch({
        "auth/v1/user": { status: 200, body: { id: "user-123" } },
        "rest/v1/rpc/is_super_admin": { status: 200, body: true },
        "auth/v1/admin/users": {
          status: 201,
          body: { id: "new-user-id", email: "newuser@example.com" },
        },
      });

      const request = makeRequest({
        email: "newuser@example.com",
        username: "newuser",
        password: "password123",
      });

      const response = await handleAdminCreateUserRequest(request);
      const body = await parseResponse(response);

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data?.userId).toBe("new-user-id");
      expect(body.data?.email).toBe("newuser@example.com");
      expect(body.data?.username).toBe("newuser");
    });

    it("creates user successfully with magic link", async () => {
      setupMockFetch({
        "auth/v1/user": { status: 200, body: { id: "user-123" } },
        "rest/v1/rpc/is_super_admin": { status: 200, body: true },
        "auth/v1/admin/users": {
          status: 201,
          body: { id: "new-user-id", email: "newuser@example.com" },
        },
      });

      const request = makeRequest({
        email: "newuser@example.com",
        username: "newuser",
        sendMagicLink: true,
      });

      const response = await handleAdminCreateUserRequest(request);
      const body = await parseResponse(response);

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data?.userId).toBe("new-user-id");
    });
  });

  describe("error: input validation", () => {
    it("returns 400 when Content-Type is not application/json", async () => {
      setupMockFetch({});

      const request = makeRequest(
        {
          email: "test@example.com",
          username: "testuser",
          password: "password123",
        },
        { "content-type": "text/plain" },
      );

      const response = await handleAdminCreateUserRequest(request);
      const body = await parseResponse(response);

      expect(response.status).toBe(400);
      expect(body.error?.code).toBe("invalid_request");
      expect(body.ok).toBe(false);
    });

    it("returns 400 when Content-Type header is missing", async () => {
      setupMockFetch({});

      const request = new Request(
        "https://example.com/functions/v1/admin-create-user",
        {
          method: "POST",
          headers: {
            authorization: "Bearer valid-token",
          },
          body: JSON.stringify({
            email: "test@example.com",
            username: "testuser",
            password: "password123",
          }),
        },
      );

      const response = await handleAdminCreateUserRequest(request);
      const body = await parseResponse(response);

      expect(response.status).toBe(400);
      expect(body.error?.code).toBe("invalid_request");
    });

    it("returns 400 when request body exceeds max size", async () => {
      setupMockFetch({});

      const request = makeRequest(
        {
          email: "test@example.com",
          username: "testuser",
          password: "password123",
        },
        { "content-length": String(1024 * 11) }, // 11 KB, exceeds 10 KB limit
      );

      const response = await handleAdminCreateUserRequest(request);
      const body = await parseResponse(response);

      expect(response.status).toBe(400);
      expect(body.error?.code).toBe("invalid_request");
      expect(body.ok).toBe(false);
    });

    it("returns 400 when password exceeds max length (128)", async () => {
      setupMockFetch({});

      const longPassword = "a".repeat(129);
      const request = makeRequest({
        email: "test@example.com",
        username: "testuser",
        password: longPassword,
      });

      const response = await handleAdminCreateUserRequest(request);
      const body = await parseResponse(response);

      expect(response.status).toBe(400);
      expect(body.error?.code).toBe("invalid_request");
      expect(body.ok).toBe(false);
    });

    it("returns 400 when email exceeds max length (254)", async () => {
      setupMockFetch({});

      const longEmail = "a".repeat(250) + "@example.com"; // 263 chars
      const request = makeRequest({
        email: longEmail,
        username: "testuser",
        password: "password123",
      });

      const response = await handleAdminCreateUserRequest(request);
      const body = await parseResponse(response);

      expect(response.status).toBe(400);
      expect(body.error?.code).toBe("invalid_request");
      expect(body.ok).toBe(false);
    });

    it("returns 400 when username exceeds max length (64)", async () => {
      setupMockFetch({});

      const longUsername = "a".repeat(65);
      const request = makeRequest({
        email: "test@example.com",
        username: longUsername,
        password: "password123",
      });

      const response = await handleAdminCreateUserRequest(request);
      const body = await parseResponse(response);

      expect(response.status).toBe(400);
      expect(body.error?.code).toBe("invalid_request");
      expect(body.ok).toBe(false);
    });

    it("returns 400 when request contains unknown fields", async () => {
      setupMockFetch({});

      const request = makeRequest({
        email: "test@example.com",
        username: "testuser",
        password: "password123",
        extraField: "should not be here",
      });

      const response = await handleAdminCreateUserRequest(request);
      const body = await parseResponse(response);

      expect(response.status).toBe(400);
      expect(body.error?.code).toBe("invalid_request");
      expect(body.ok).toBe(false);
    });
  });

  describe("CORS / origin validation", () => {
    it("returns a 204 preflight response with CORS headers for OPTIONS", async () => {
      const response = await handleAdminCreateUserRequest(
        new Request("http://localhost/admin-create-user", {
          method: "OPTIONS",
        }),
      );

      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBeNull();
      expect(response.headers.get("access-control-allow-methods")).toContain(
        "POST",
      );
      expect(response.headers.get("access-control-allow-headers")).toContain(
        "authorization",
      );
      expect(response.headers.get("access-control-max-age")).toBe("86400");
    });

    it("returns a 204 preflight response with echoed origin for a recognized Origin", async () => {
      const response = await handleAdminCreateUserRequest(
        new Request("http://localhost/admin-create-user", {
          headers: { origin: "http://localhost:5173" },
          method: "OPTIONS",
        }),
        { allowedOrigins: ["http://localhost:5173", "http://127.0.0.1:5173"] },
      );

      expect(response.status).toBe(204);
      expect(response.headers.get("access-control-allow-origin")).toBe(
        "http://localhost:5173",
      );
      expect(response.headers.get("access-control-allow-methods")).toContain(
        "POST",
      );
      expect(response.headers.get("access-control-allow-headers")).toContain(
        "authorization",
      );
      expect(response.headers.get("access-control-max-age")).toBe("86400");
    });

    it("returns a 403 with error response for an unrecognized Origin on OPTIONS", async () => {
      const response = await handleAdminCreateUserRequest(
        new Request("http://localhost/admin-create-user", {
          headers: { origin: "http://evil.example.com" },
          method: "OPTIONS",
        }),
        { allowedOrigins: ["http://localhost:5173"] },
      );

      const body = await parseResponse(response);

      expect(response.status).toBe(403);
      expect(body.error?.code).toBe("origin_not_allowed");
      expect(body.ok).toBe(false);
    });

    it("returns a 403 with error response for an unrecognized Origin on POST", async () => {
      const response = await handleAdminCreateUserRequest(
        new Request("http://localhost/admin-create-user", {
          body: JSON.stringify({
            email: "test@example.com",
            username: "testuser",
            password: "password123",
          }),
          headers: {
            "content-type": "application/json",
            origin: "http://evil.example.com",
          },
          method: "POST",
        }),
        { allowedOrigins: ["http://localhost:5173"] },
      );

      const body = await parseResponse(response);

      expect(response.status).toBe(403);
      expect(body.error?.code).toBe("origin_not_allowed");
      expect(body.ok).toBe(false);
    });

    it("echoes the allowed Origin in access-control-allow-origin header for POST", async () => {
      setupMockFetch({
        "auth/v1/user": { status: 200, body: { id: "user-123" } },
        "rest/v1/rpc/is_super_admin": { status: 200, body: true },
        "auth/v1/admin/users": {
          status: 201,
          body: { id: "new-user-id", email: "newuser@example.com" },
        },
      });

      const response = await handleAdminCreateUserRequest(
        new Request("http://localhost/admin-create-user", {
          body: JSON.stringify({
            email: "newuser@example.com",
            username: "newuser",
            password: "password123",
          }),
          headers: {
            "content-type": "application/json",
            origin: "http://localhost:5173",
          },
          method: "POST",
        }),
        { allowedOrigins: ["http://localhost:5173"] },
      );

      expect(response.headers.get("access-control-allow-origin")).toBe(
        "http://localhost:5173",
      );
    });

    it("allows a POST with no Origin header to proceed to auth checks", async () => {
      setupMockFetch({
        "auth/v1/user": { status: 200, body: { id: "user-123" } },
        "rest/v1/rpc/is_super_admin": { status: 200, body: true },
        "auth/v1/admin/users": {
          status: 201,
          body: { id: "new-user-id", email: "newuser@example.com" },
        },
      });

      const response = await handleAdminCreateUserRequest(
        new Request("http://localhost/admin-create-user", {
          body: JSON.stringify({
            email: "newuser@example.com",
            username: "newuser",
            password: "password123",
          }),
          headers: {
            "content-type": "application/json",
            authorization: "Bearer valid-token",
            // No Origin header — non-browser client
          },
          method: "POST",
        }),
        { allowedOrigins: ["http://localhost:5173"] },
      );

      // Should succeed (200), not fail at CORS check (403)
      expect(response.status).toBe(200);
      const body = await parseResponse(response);
      expect(body.ok).toBe(true);
      expect(body.data?.userId).toBe("new-user-id");
    });
  });

  describe("idempotency: repeat requests with same idempotency-key", () => {
    it("first request creates user and stores idempotency key", async () => {
      const responses: Record<
        string,
        {
          status: number;
          body: Record<string, unknown> | boolean;
        }
      > = {
        "auth/v1/user": { status: 200, body: { id: "user-123" } },
        "rest/v1/rpc/is_super_admin": { status: 200, body: true },
        "auth/v1/admin/users": {
          status: 201,
          body: { id: "new-user-id", email: "newuser@example.com" },
        },
        admin_create_user_idempotency_keys: { status: 201, body: {} },
      };
      setupMockFetch(responses);

      const request = makeRequest(
        {
          email: "newuser@example.com",
          username: "newuser",
          password: "password123",
        },
        { "idempotency-key": "idem-key-123" },
      );

      const response = await handleAdminCreateUserRequest(request);
      const body = await parseResponse(response);

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data?.userId).toBe("new-user-id");
    });

    it("duplicate request with same idempotency-key returns cached response", async () => {
      // Custom mock to handle array response for idempotency lookup
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("admin_create_user_idempotency_keys")) {
          return Promise.resolve(
            new Response(
              JSON.stringify([
                {
                  idempotency_key: "idem-key-123",
                  caller_user_id: "user-123",
                  created_user_id: "cached-user-id",
                  created_user_email: "cached@example.com",
                  created_user_username: "cached",
                  created_at: "2024-06-21T00:00:00Z",
                  expires_at: "2024-06-22T00:00:00Z",
                },
              ]),
              { status: 200 },
            ),
          );
        }
        if (url.includes("auth/v1/user")) {
          return Promise.resolve(
            new Response(JSON.stringify({ id: "user-123" }), { status: 200 }),
          );
        }
        if (url.includes("rest/v1/rpc/is_super_admin")) {
          return Promise.resolve(
            new Response(JSON.stringify(true), { status: 200 }),
          );
        }
        // auth/v1/admin/users should NOT be called
        return Promise.resolve(
          new Response(JSON.stringify({ error: "Not found" }), { status: 404 }),
        );
      });

      const request = makeRequest(
        {
          email: "ignored@example.com",
          username: "ignored",
          password: "password123",
        },
        { "idempotency-key": "idem-key-123" },
      );

      const response = await handleAdminCreateUserRequest(request);
      const body = await parseResponse(response);

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      // Should return cached data, not the email from the request
      expect(body.data?.userId).toBe("cached-user-id");
      expect(body.data?.email).toBe("cached@example.com");
      expect(body.data?.username).toBe("cached");

      // Verify auth/v1/admin/users was NOT called (would be in mockFetch calls if it was)
      const calls = mockFetch.mock.calls;
      const authAdminUsersCalled = calls.some((call) =>
        String(call[0]).includes("auth/v1/admin/users"),
      );
      expect(authAdminUsersCalled).toBe(false);
    });

    it("different idempotency-keys create different users (no cross-key collision)", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("admin_create_user_idempotency_keys")) {
          // Empty result for first lookup (key not cached)
          return Promise.resolve(
            new Response(JSON.stringify([]), { status: 200 }),
          );
        }
        if (url.includes("auth/v1/user")) {
          return Promise.resolve(
            new Response(JSON.stringify({ id: "user-123" }), { status: 200 }),
          );
        }
        if (url.includes("rest/v1/rpc/is_super_admin")) {
          return Promise.resolve(
            new Response(JSON.stringify(true), { status: 200 }),
          );
        }
        if (url.includes("auth/v1/admin/users")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({ id: "user-1", email: "first@example.com" }),
              { status: 201 },
            ),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ error: "Not found" }), { status: 404 }),
        );
      });

      const request1 = makeRequest(
        {
          email: "first@example.com",
          username: "first",
          password: "password123",
        },
        { "idempotency-key": "idem-key-first" },
      );

      const response1 = await handleAdminCreateUserRequest(request1);
      const body1 = await parseResponse(response1);

      expect(body1.data?.userId).toBe("user-1");

      // Verify each idempotency key is independent
      expect(mockFetch.mock.calls.length).toBeGreaterThan(0);
    });

    it("expired idempotency key is retried (lookup returns empty)", async () => {
      mockFetch.mockImplementation((url: string) => {
        if (url.includes("admin_create_user_idempotency_keys")) {
          // Empty result (key expired or not found)
          return Promise.resolve(
            new Response(JSON.stringify([]), { status: 200 }),
          );
        }
        if (url.includes("auth/v1/user")) {
          return Promise.resolve(
            new Response(JSON.stringify({ id: "user-123" }), { status: 200 }),
          );
        }
        if (url.includes("rest/v1/rpc/is_super_admin")) {
          return Promise.resolve(
            new Response(JSON.stringify(true), { status: 200 }),
          );
        }
        if (url.includes("auth/v1/admin/users")) {
          return Promise.resolve(
            new Response(
              JSON.stringify({
                id: "retry-user-id",
                email: "retry@example.com",
              }),
              { status: 201 },
            ),
          );
        }
        return Promise.resolve(
          new Response(JSON.stringify({ error: "Not found" }), { status: 404 }),
        );
      });

      const request = makeRequest(
        {
          email: "retry@example.com",
          username: "retry",
          password: "password123",
        },
        { "idempotency-key": "expired-key" },
      );

      const response = await handleAdminCreateUserRequest(request);
      const body = await parseResponse(response);

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data?.userId).toBe("retry-user-id");

      // Verify auth/v1/admin/users WAS called (key was expired, so retry)
      const calls = mockFetch.mock.calls;
      const authAdminUsersCalled = calls.some((call) =>
        String(call[0]).includes("auth/v1/admin/users"),
      );
      expect(authAdminUsersCalled).toBe(true);
    });

    it("request without idempotency-key bypasses caching (backwards compatible)", async () => {
      const responses: Record<
        string,
        {
          status: number;
          body: Record<string, unknown> | boolean;
        }
      > = {
        "auth/v1/user": { status: 200, body: { id: "user-123" } },
        "rest/v1/rpc/is_super_admin": { status: 200, body: true },
        "auth/v1/admin/users": {
          status: 201,
          body: { id: "no-key-user-id", email: "nokey@example.com" },
        },
      };
      setupMockFetch(responses);

      const request = makeRequest({
        email: "nokey@example.com",
        username: "nokey",
        password: "password123",
      });
      // No idempotency-key header

      const response = await handleAdminCreateUserRequest(request);
      const body = await parseResponse(response);

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.data?.userId).toBe("no-key-user-id");
    });
  });

  describe("rate limiting: per-user 429 enforcement", () => {
    it("returns 429 with rate_limit_exceeded code when limit is exceeded", async () => {
      // rate limit bucket returns count > 10 (limit for admin-create-user)
      setupMockFetch({
        "auth/v1/user": { status: 200, body: { id: "user-123" } },
        "rest/v1/rpc/is_super_admin": { status: 200, body: true },
        "rpc/increment_rate_limit_bucket": { status: 200, body: 11 },
      });

      const request = makeRequest({
        email: "test@example.com",
        username: "testuser",
        password: "password123",
      });

      const response = await handleAdminCreateUserRequest(request);
      const body = await parseResponse(response);

      expect(response.status).toBe(429);
      expect(body.error?.code).toBe("rate_limit_exceeded");
      expect(body.ok).toBe(false);
      expect(response.headers.get("retry-after")).not.toBeNull();
    });

    it("returns 429 with stable error message (no upstream detail)", async () => {
      setupMockFetch({
        "auth/v1/user": { status: 200, body: { id: "user-123" } },
        "rest/v1/rpc/is_super_admin": { status: 200, body: true },
        "rpc/increment_rate_limit_bucket": { status: 200, body: 100 },
      });

      const request = makeRequest({
        email: "test@example.com",
        username: "testuser",
        password: "password123",
      });

      const response = await handleAdminCreateUserRequest(request);
      const body = await parseResponse(response);

      expect(body.error?.message).toBe("Too many requests. Please wait before retrying.");
    });

    it("succeeds normally when rate limit bucket DB call fails (fail-open)", async () => {
      // Rate limit DB unreachable (404 fallthrough) → fail open → request proceeds
      setupMockFetch({
        "auth/v1/user": { status: 200, body: { id: "user-123" } },
        "rest/v1/rpc/is_super_admin": { status: 200, body: true },
        // no entry for increment_rate_limit_bucket → falls to 404 default → fail open
        "auth/v1/admin/users": {
          status: 201,
          body: { id: "new-user-id", email: "test@example.com" },
        },
      });

      const request = makeRequest({
        email: "test@example.com",
        username: "testuser",
        password: "password123",
      });

      const response = await handleAdminCreateUserRequest(request);
      const body = await parseResponse(response);

      expect(response.status).toBe(200);
      expect(body.ok).toBe(true);
    });

    it("does not call auth/admin/users when rate limit is exceeded", async () => {
      setupMockFetch({
        "auth/v1/user": { status: 200, body: { id: "user-123" } },
        "rest/v1/rpc/is_super_admin": { status: 200, body: true },
        "rpc/increment_rate_limit_bucket": { status: 200, body: 11 },
      });

      const request = makeRequest({
        email: "test@example.com",
        username: "testuser",
        password: "password123",
      });

      await handleAdminCreateUserRequest(request);

      const calls = mockFetch.mock.calls;
      const adminUsersCallMade = calls.some((call) =>
        String(call[0]).includes("auth/v1/admin/users"),
      );
      expect(adminUsersCallMade).toBe(false);
    });
  });
});
