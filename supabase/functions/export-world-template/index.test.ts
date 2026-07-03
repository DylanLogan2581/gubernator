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

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  vi.stubGlobal("Deno", {
    env: {
      get: (key: string) => {
        const env: Record<string, string> = {
          SUPABASE_URL,
          SUPABASE_ANON_KEY,
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
    // The super-admin RPC call fails (non-2xx), so isAuthorized()
    // short-circuits to null -> 502. This proves the request passed
    // content-type, size, and worldId validation before reaching authz.
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

    const request = makeRequest({ worldId: VALID_UUID });
    const response = await handleExportWorldTemplateRequest(request);
    const body = await parseResponse(response);

    expect(response.status).toBe(502);
    expect(body.error?.code).toBe("authorization_check_failed");
  });
});
