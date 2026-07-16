import { describe, expect, it } from "vitest";

import { readSendEmailErrorPayload } from "./sendEmailErrorPayload";

describe("readSendEmailErrorPayload", () => {
  it("decodes an error's JSON response body", async () => {
    const context = new Response(
      JSON.stringify({
        error: { code: "origin_not_allowed", message: "Origin not allowed." },
        ok: false,
      }),
    );

    const payload = await readSendEmailErrorPayload({ context });

    expect(payload).toEqual({
      error: { code: "origin_not_allowed", message: "Origin not allowed." },
      ok: false,
    });
  });

  it("returns null when the error has no context", async () => {
    await expect(readSendEmailErrorPayload(new Error("boom"))).resolves.toBe(
      null,
    );
  });

  it("returns null when the context body isn't the expected shape", async () => {
    const context = new Response(JSON.stringify({ unexpected: true }));

    await expect(readSendEmailErrorPayload({ context })).resolves.toBe(null);
  });

  it("returns null when the context body isn't valid JSON", async () => {
    const context = new Response("not json");

    await expect(readSendEmailErrorPayload({ context })).resolves.toBe(null);
  });
});
