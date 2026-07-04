/**
 * Streamed, byte-capped JSON body reading for privileged edge functions.
 *
 * `Request.json()` buffers the entire body before parsing. Relying on the
 * `content-length` header to reject oversized requests is not enough: a
 * client sending `Transfer-Encoding: chunked` (no `content-length`) can still
 * make the runtime buffer an unbounded body before any check runs. This
 * reader enforces a hard byte cap while streaming, aborting the read as soon
 * as the cap is exceeded regardless of what (if anything) `content-length`
 * claims.
 */

export const DEFAULT_MAX_JSON_BODY_BYTES = 1024 * 10; // 10 KB

export type ReadCappedJsonBodyFailureReason =
  | "body_too_large"
  | "invalid_content_type"
  | "invalid_json";

export type ReadCappedJsonBodyResult =
  | { readonly ok: true; readonly value: unknown }
  | {
    readonly ok: false;
    readonly reason: ReadCappedJsonBodyFailureReason;
    readonly status: number;
  };

/**
 * Reads and JSON-parses a request body, enforcing `content-type:
 * application/json` and a hard byte cap enforced via streaming (not the
 * `content-length` header).
 */
export async function readCappedJsonBody(
  request: Request,
  options: { readonly maxBytes?: number } = {},
): Promise<ReadCappedJsonBodyResult> {
  const contentType = request.headers.get("content-type");
  if (contentType === null || !contentType.includes("application/json")) {
    return { ok: false, reason: "invalid_content_type", status: 400 };
  }

  const maxBytes = options.maxBytes ?? DEFAULT_MAX_JSON_BODY_BYTES;

  const bodyStream = request.body;
  if (bodyStream === null) {
    return { ok: false, reason: "invalid_json", status: 400 };
  }

  const reader = bodyStream.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  for (;;) {
    let chunk: ReadableStreamReadResult<Uint8Array>;
    try {
      chunk = await reader.read();
    } catch {
      return { ok: false, reason: "invalid_json", status: 400 };
    }

    if (chunk.done) break;

    totalBytes += chunk.value.byteLength;

    if (totalBytes > maxBytes) {
      // Cancel immediately: stop pulling from the stream instead of
      // buffering the rest of an oversized (possibly chunked, no
      // content-length) body.
      await reader.cancel().catch(() => undefined);
      return { ok: false, reason: "body_too_large", status: 413 };
    }

    chunks.push(chunk.value);
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder().decode(combined);
    const value: unknown = JSON.parse(text);
    return { ok: true, value };
  } catch {
    return { ok: false, reason: "invalid_json", status: 400 };
  }
}
