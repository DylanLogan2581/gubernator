import { afterEach, describe, expect, it, vi } from "vitest";

import { handleEndTurnSimulationRequest } from "./index";

afterEach(() => {
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// CORS / method gate — these paths resolve before any async IO
// ---------------------------------------------------------------------------

describe("handleEndTurnSimulationRequest", () => {
  it("returns a 204 preflight response with CORS headers for OPTIONS", async () => {
    const response = await handleEndTurnSimulationRequest(
      new Request("http://localhost/end-turn-simulation", {
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
  });

  it("returns a 204 preflight response with echoed origin for a recognized Origin", async () => {
    const response = await handleEndTurnSimulationRequest(
      new Request("http://localhost/end-turn-simulation", {
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
  });

  it("returns a 403 for an unrecognized Origin on OPTIONS", async () => {
    const response = await handleEndTurnSimulationRequest(
      new Request("http://localhost/end-turn-simulation", {
        headers: { origin: "http://evil.example.com" },
        method: "OPTIONS",
      }),
      { allowedOrigins: ["http://localhost:5173"] },
    );

    expect(response.status).toBe(403);
  });

  it("returns a 403 for an unrecognized Origin on POST", async () => {
    const response = await handleEndTurnSimulationRequest(
      new Request("http://localhost/end-turn-simulation", {
        body: JSON.stringify({ expectedTurnNumber: 1, worldId: "world-1" }),
        headers: {
          "content-type": "application/json",
          origin: "http://evil.example.com",
        },
        method: "POST",
      }),
      { allowedOrigins: ["http://localhost:5173"] },
    );

    expect(response.status).toBe(403);
  });

  it("returns a 405 for non-POST methods", async () => {
    const response = await handleEndTurnSimulationRequest(
      new Request("http://localhost/end-turn-simulation", { method: "GET" }),
    );

    const responseBody: unknown = await response.json();

    expect(response.status).toBe(405);
    expect(responseBody).toEqual({
      error: {
        code: "method_not_allowed",
        message: "Use POST to request an end-turn simulation.",
      },
      ok: false,
    });
  });

  it("echoes the allowed Origin in access-control-allow-origin header", async () => {
    const response = await handleEndTurnSimulationRequest(
      new Request("http://localhost/end-turn-simulation", {
        body: JSON.stringify({ expectedTurnNumber: 1, worldId: "world-1" }),
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

  it("returns 400 for an invalid request body on POST", async () => {
    const response = await handleEndTurnSimulationRequest(
      new Request("http://localhost/end-turn-simulation", {
        body: "not-json",
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    const responseBody: unknown = await response.json();
    expect(response.status).toBe(400);
    expect(responseBody).toMatchObject({
      error: { code: "invalid_request" },
      ok: false,
    });
  });
});
