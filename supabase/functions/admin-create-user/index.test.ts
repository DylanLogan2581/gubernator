import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleAdminCreateUserRequest } from "./index";

// Mock environment variables
const SUPABASE_URL = "https://example.supabase.co";
const SUPABASE_ANON_KEY = "test-anon-key";
const SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";

type ResponseBody = {
  error?: { code?: string };
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
    { status: number; body: Record<string, unknown> | boolean } | Error
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
});
