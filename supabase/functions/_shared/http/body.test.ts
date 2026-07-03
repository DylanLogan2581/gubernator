import { describe, expect, it } from "vitest";

import { readCappedJsonBody } from "./body.ts";

const MAX_BYTES = 1024 * 10; // 10 KB

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

  // Streaming a ReadableStream body (no explicit content-length) is how
  // Transfer-Encoding: chunked requests surface to the handler.
  return new Request("http://localhost/", {
    body: stream,
    duplex: "half",
    headers,
    method: "POST",
  } as RequestInit);
}

function repeatBytes(byte: number, count: number): Uint8Array {
  return new Uint8Array(count).fill(byte);
}

describe("readCappedJsonBody", () => {
  it("accepts an under-cap body streamed without content-length", async () => {
    const body = JSON.stringify({ hello: "world" });
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(body));
        controller.close();
      },
    });
    const request = new Request("http://localhost/", {
      body: stream,
      duplex: "half",
      headers: { "content-type": "application/json" },
      method: "POST",
    } as RequestInit);

    expect(request.headers.get("content-length")).toBeNull();

    const result = await readCappedJsonBody(request);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ hello: "world" });
    }
  });

  it("rejects a chunked body exceeding the byte cap with 413, without content-length", async () => {
    // 11 KB of padding, spread across many small chunks the way a chunked
    // transfer-encoding client would deliver it. No content-length header.
    const padding = JSON.stringify({ padding: "x".repeat(1024 * 11) });
    const encoded = new TextEncoder().encode(padding);
    const chunkSize = 256;
    const chunks: Uint8Array[] = [];
    for (let offset = 0; offset < encoded.byteLength; offset += chunkSize) {
      chunks.push(encoded.slice(offset, offset + chunkSize));
    }
    const request = makeStreamedRequest(chunks);

    expect(request.headers.get("content-length")).toBeNull();

    const result = await readCappedJsonBody(request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("body_too_large");
      expect(result.status).toBe(413);
    }
  });

  it("rejects an over-cap body even when content-length understates the size", async () => {
    // Guards against trusting content-length: header claims a tiny body,
    // but the stream actually delivers more than MAX_BYTES.
    const oversized = repeatBytes(0x61, MAX_BYTES + 1024);
    const request = makeStreamedRequest([oversized], {
      "content-length": "10",
      "content-type": "application/json",
    });

    const result = await readCappedJsonBody(request, { maxBytes: MAX_BYTES });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("body_too_large");
      expect(result.status).toBe(413);
    }
  });

  it("accepts a body right at the cap", async () => {
    const value = { padding: "x".repeat(MAX_BYTES - 20) };
    const encoded = new TextEncoder().encode(JSON.stringify(value));
    expect(encoded.byteLength).toBeLessThanOrEqual(MAX_BYTES);

    const request = makeStreamedRequest([encoded]);

    const result = await readCappedJsonBody(request, { maxBytes: MAX_BYTES });

    expect(result.ok).toBe(true);
  });

  it("rejects a missing content-type header", async () => {
    const request = makeStreamedRequest(
      [new TextEncoder().encode(JSON.stringify({ ok: true }))],
      {},
    );

    const result = await readCappedJsonBody(request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_content_type");
      expect(result.status).toBe(400);
    }
  });

  it("rejects a non-JSON content-type header", async () => {
    const request = makeStreamedRequest(
      [new TextEncoder().encode(JSON.stringify({ ok: true }))],
      { "content-type": "text/plain" },
    );

    const result = await readCappedJsonBody(request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_content_type");
    }
  });

  it("rejects invalid JSON with invalid_json", async () => {
    const request = makeStreamedRequest([new TextEncoder().encode("not json")]);

    const result = await readCappedJsonBody(request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_json");
      expect(result.status).toBe(400);
    }
  });

  it("rejects an empty body with invalid_json", async () => {
    const request = makeStreamedRequest([]);

    const result = await readCappedJsonBody(request);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_json");
    }
  });
});
