import { describe, expect, it, vi } from "vitest";

import {
  handleEndTurnBasicRequest,
  type EndTurnBasicAuthContextResult,
} from "./index";

describe("handleEndTurnBasicRequest", () => {
  it("returns a typed error response for an invalid request body", async () => {
    const resolveAuthContext = vi.fn<
      () => Promise<EndTurnBasicAuthContextResult>
    >(() =>
      Promise.resolve({
        context: {
          userId: "user-1",
        },
        ok: true,
      }),
    );

    const response = await handleEndTurnBasicRequest(
      createJsonRequest({
        expectedTurnNumber: "1",
        worldId: "",
      }),
      {
        resolveAuthContext,
      },
    );

    const responseBody: unknown = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody).toEqual({
      error: {
        code: "invalid_request",
        details: ["worldId", "expectedTurnNumber"],
        message: "Request body must include worldId and expectedTurnNumber.",
      },
      ok: false,
    });
    expect(resolveAuthContext).not.toHaveBeenCalled();
  });

  it("returns a typed error response for malformed JSON", async () => {
    const response = await handleEndTurnBasicRequest(
      new Request("http://localhost/end-turn-basic", {
        body: "{",
        headers: {
          "content-type": "application/json",
        },
        method: "POST",
      }),
    );

    const responseBody: unknown = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody).toEqual({
      error: {
        code: "invalid_request",
        details: ["body"],
        message: "Request body must be valid JSON.",
      },
      ok: false,
    });
  });

  it("returns a typed error response for an unauthenticated request", async () => {
    const response = await handleEndTurnBasicRequest(
      createJsonRequest({
        expectedTurnNumber: 3,
        worldId: "world-1",
      }),
    );

    const responseBody: unknown = await response.json();

    expect(response.status).toBe(401);
    expect(responseBody).toEqual({
      error: {
        code: "unauthenticated",
        message: "An authenticated Supabase session is required.",
      },
      ok: false,
    });
  });
});

function createJsonRequest(body: unknown): Request {
  return new Request("http://localhost/end-turn-basic", {
    body: JSON.stringify(body),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
}
