import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { handleExportWorldTemplateRequest } from "./index";

const SUPABASE_URL = "https://example.supabase.co";
const SUPABASE_ANON_KEY = "test-anon-key";
const VALID_UUID = "00000000-0000-0000-0000-000000000001";

type ResponseBody = {
  error?: { code?: string; message?: string };
  ok?: boolean;
};

const mockFetch = vi.fn();

async function parseResponse(response: Response): Promise<ResponseBody> {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const body = await response.json();
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return body;
}

const SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
const EXPORT_WORLD_TEMPLATE_ALLOWED_ORIGINS = "https://app.example.com";

function stubDenoEnv(extra: Record<string, string> = {}): void {
  vi.stubGlobal("Deno", {
    env: {
      get: (key: string) => {
        const env: Record<string, string> = {
          SUPABASE_URL,
          SUPABASE_ANON_KEY,
          ...extra,
        };
        return env[key];
      },
    },
  });
}

function authUserResponse(userId = "00000000-0000-0000-0000-0000000000aa"): Response {
  return new Response(JSON.stringify({ id: userId }), { status: 200 });
}

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  stubDenoEnv();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

function makeRequest(body?: unknown, headers?: Record<string, string>): Request {
  const defaultHeaders = {
    authorization: "Bearer valid-token",
    "content-type": "application/json",
    ...headers,
  };
  return new Request("https://example.com/functions/v1/export-world-template", {
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: defaultHeaders,
    method: "POST",
  });
}

function makeStreamedRequest(
  chunks: readonly Uint8Array[],
  headers: Record<string, string>,
): Request {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
  return new Request("https://example.com/functions/v1/export-world-template", {
    body: stream,
    duplex: "half",
    headers,
    method: "POST",
  } as RequestInit);
}

describe("handleExportWorldTemplateRequest", () => {
  it("responds to OPTIONS preflight without touching the body", async () => {
    const request = new Request("https://example.com/functions/v1/export-world-template", {
      method: "OPTIONS",
    });
    const response = await handleExportWorldTemplateRequest(request);
    expect(response.status).toBe(204);
  });

  it("rejects non-POST methods", async () => {
    const request = new Request("https://example.com/functions/v1/export-world-template", {
      method: "GET",
    });
    const response = await handleExportWorldTemplateRequest(request);
    const body = await parseResponse(response);
    expect(response.status).toBe(405);
    expect(body.error?.code).toBe("method_not_allowed");
  });

  it("rejects a missing Authorization header before reading the body", async () => {
    const request = makeRequest({ worldId: VALID_UUID }, { authorization: "" });
    // `Request` drops an empty header value, simulating "no Authorization header".
    const response = await handleExportWorldTemplateRequest(request);
    const body = await parseResponse(response);
    expect(response.status).toBe(401);
    expect(body.error?.code).toBe("unauthenticated");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("rejects a non-JSON Content-Type", async () => {
    const request = makeRequest({ worldId: VALID_UUID }, { "content-type": "text/plain" });
    const response = await handleExportWorldTemplateRequest(request);
    const body = await parseResponse(response);
    expect(response.status).toBe(400);
    expect(body.error?.code).toBe("invalid_request");
  });

  it("rejects an invalid worldId", async () => {
    const request = makeRequest({ worldId: "not-a-uuid" });
    const response = await handleExportWorldTemplateRequest(request);
    const body = await parseResponse(response);
    expect(response.status).toBe(400);
    expect(body.error?.code).toBe("invalid_request");
  });

  it("returns 413 for a chunked body exceeding max size with no content-length header, even when unauthenticated Origin/JWT is absent", async () => {
    const oversizedPayload = JSON.stringify({
      padding: "x".repeat(1024 * 11),
      worldId: VALID_UUID,
    });
    const encoded = new TextEncoder().encode(oversizedPayload);
    const chunkSize = 256;
    const chunks: Uint8Array[] = [];
    for (let offset = 0; offset < encoded.byteLength; offset += chunkSize) {
      chunks.push(encoded.slice(offset, offset + chunkSize));
    }
    const request = makeStreamedRequest(chunks, {
      authorization: "Bearer valid-token",
      "content-type": "application/json",
    });

    expect(request.headers.get("content-length")).toBeNull();

    const response = await handleExportWorldTemplateRequest(request);
    const body = await parseResponse(response);

    expect(response.status).toBe(413);
    expect(body.error?.code).toBe("invalid_request");
  });

  it("accepts an under-cap body and proceeds past validation to authorization", async () => {
    // /auth/v1/user resolves the caller (needed for the rate-limit bucket),
    // then the super-admin RPC call fails (non-2xx), so isAuthorized()
    // short-circuits to null -> 502. This proves the request passed
    // content-type, size, and worldId validation before reaching authz.
    mockFetch.mockResolvedValueOnce(authUserResponse());
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

    const request = makeRequest({ worldId: VALID_UUID });
    const response = await handleExportWorldTemplateRequest(request);
    const body = await parseResponse(response);

    expect(response.status).toBe(502);
    expect(body.error?.code).toBe("authorization_check_failed");
  });

  it("rejects unauthenticated when /auth/v1/user resolution fails", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));

    const request = makeRequest({ worldId: VALID_UUID });
    const response = await handleExportWorldTemplateRequest(request);
    const body = await parseResponse(response);

    expect(response.status).toBe(401);
    expect(body.error?.code).toBe("unauthenticated");
  });
});

describe("handleExportWorldTemplateRequest origin allowlist", () => {
  it("rejects a disallowed Origin with 403 origin_not_allowed", async () => {
    stubDenoEnv({ EXPORT_WORLD_TEMPLATE_ALLOWED_ORIGINS });

    const request = makeRequest(
      { worldId: VALID_UUID },
      { origin: "https://evil.example.com" },
    );
    const response = await handleExportWorldTemplateRequest(request);
    const body = await parseResponse(response);

    expect(response.status).toBe(403);
    expect(body.error?.code).toBe("origin_not_allowed");
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("echoes an allowed Origin in access-control-allow-origin", async () => {
    stubDenoEnv({ EXPORT_WORLD_TEMPLATE_ALLOWED_ORIGINS });
    mockFetch.mockResolvedValueOnce(authUserResponse());
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

    const request = makeRequest(
      { worldId: VALID_UUID },
      { origin: "https://app.example.com" },
    );
    const response = await handleExportWorldTemplateRequest(request);

    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://app.example.com",
    );
  });

  it("allows an OPTIONS preflight from an allowed Origin", async () => {
    stubDenoEnv({ EXPORT_WORLD_TEMPLATE_ALLOWED_ORIGINS });

    const request = new Request("https://example.com/functions/v1/export-world-template", {
      headers: { origin: "https://app.example.com" },
      method: "OPTIONS",
    });
    const response = await handleExportWorldTemplateRequest(request);

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "https://app.example.com",
    );
  });
});

describe("handleExportWorldTemplateRequest rate limiting", () => {
  it("rejects with 429 rate_limit_exceeded once the per-user bucket is exhausted", async () => {
    stubDenoEnv({ SUPABASE_SERVICE_ROLE_KEY });
    mockFetch.mockResolvedValueOnce(authUserResponse());
    // increment_rate_limit_bucket returns the post-increment count; above the
    // export-world-template limit (5) trips the 429 path.
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(6), { status: 200 }));

    const request = makeRequest({ worldId: VALID_UUID });
    const response = await handleExportWorldTemplateRequest(request);
    const body = await parseResponse(response);

    expect(response.status).toBe(429);
    expect(body.error?.code).toBe("rate_limit_exceeded");
    expect(response.headers.get("retry-after")).not.toBeNull();
    // Rate limit trips before the authorization RPC calls: only the two
    // rate-limit-path fetches (auth/v1/user, increment_rate_limit_bucket)
    // should have fired.
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("proceeds past the rate limiter when under the bucket limit", async () => {
    stubDenoEnv({ SUPABASE_SERVICE_ROLE_KEY });
    mockFetch.mockResolvedValueOnce(authUserResponse());
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify(1), { status: 200 }));
    // Authorization RPC (is_super_admin) fails -> 502, proving the request
    // reached authz instead of being rate-limited.
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

    const request = makeRequest({ worldId: VALID_UUID });
    const response = await handleExportWorldTemplateRequest(request);
    const body = await parseResponse(response);

    expect(response.status).toBe(502);
    expect(body.error?.code).toBe("authorization_check_failed");
  });
});
