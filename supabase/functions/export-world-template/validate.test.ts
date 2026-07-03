import { describe, expect, it } from "vitest";

import { parseExportWorldTemplateRequestBody } from "./validate";

const VALID_UUID = "00000000-0000-0000-0000-000000000001";

function makeRequest(body: unknown, headers?: Record<string, string>): Request {
  const defaultHeaders = {
    "content-type": "application/json",
    ...headers,
  };
  return new Request("http://localhost/", {
    body: JSON.stringify(body),
    headers: defaultHeaders,
    method: "POST",
  });
}

function makeStreamedRequest(
  chunks: readonly Uint8Array[],
  headers: Record<string, string> = { "content-type": "application/json" },
): Request {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });

  return new Request("http://localhost/", {
    body: stream,
    duplex: "half",
    headers,
    method: "POST",
  } as RequestInit);
}

describe("parseExportWorldTemplateRequestBody", () => {
  it("accepts a valid request", async () => {
    const result = await parseExportWorldTemplateRequestBody(
      makeRequest({ worldId: VALID_UUID }),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body.worldId).toBe(VALID_UUID);
    }
  });

  it("rejects a non-UUID worldId", async () => {
    const result = await parseExportWorldTemplateRequestBody(
      makeRequest({ worldId: "not-a-uuid" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("rejects missing worldId", async () => {
    const result = await parseExportWorldTemplateRequestBody(makeRequest({}));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("rejects a missing Content-Type header", async () => {
    const req = new Request("http://localhost/", {
      body: JSON.stringify({ worldId: VALID_UUID }),
      method: "POST",
    });
    const result = await parseExportWorldTemplateRequestBody(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("rejects a non-JSON Content-Type header", async () => {
    const result = await parseExportWorldTemplateRequestBody(
      makeRequest({ worldId: VALID_UUID }, { "content-type": "text/plain" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("rejects invalid JSON", async () => {
    const req = new Request("http://localhost/", {
      body: "not json",
      headers: { "content-type": "application/json" },
      method: "POST",
    });
    const result = await parseExportWorldTemplateRequestBody(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
    }
  });

  it("rejects a chunked body exceeding max size with no content-length header", async () => {
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
    const req = makeStreamedRequest(chunks);

    expect(req.headers.get("content-length")).toBeNull();

    const result = await parseExportWorldTemplateRequestBody(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(413);
    }
  });

  it("accepts an under-cap body streamed without content-length", async () => {
    const encoded = new TextEncoder().encode(JSON.stringify({ worldId: VALID_UUID }));
    const req = makeStreamedRequest([encoded]);

    expect(req.headers.get("content-length")).toBeNull();

    const result = await parseExportWorldTemplateRequestBody(req);
    expect(result.ok).toBe(true);
  });
});
