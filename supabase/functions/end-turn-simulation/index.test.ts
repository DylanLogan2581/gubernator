import { afterEach, describe, expect, it, vi } from "vitest";

import { handleEndTurnSimulationRequest } from "./index";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("handleEndTurnSimulationRequest", () => {
  it("returns a 204 preflight response with CORS headers for OPTIONS", () => {
    const response = handleEndTurnSimulationRequest(
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

  it("returns a 204 preflight response with echoed origin for a recognized Origin", () => {
    const response = handleEndTurnSimulationRequest(
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

  it("returns a 403 for an unrecognized Origin on OPTIONS", () => {
    const response = handleEndTurnSimulationRequest(
      new Request("http://localhost/end-turn-simulation", {
        headers: { origin: "http://evil.example.com" },
        method: "OPTIONS",
      }),
      { allowedOrigins: ["http://localhost:5173"] },
    );

    expect(response.status).toBe(403);
  });

  it("returns a 403 for an unrecognized Origin on POST", () => {
    const response = handleEndTurnSimulationRequest(
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
    const response = handleEndTurnSimulationRequest(
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

  it("returns a typed 501 not_implemented response for POST", async () => {
    const response = handleEndTurnSimulationRequest(
      new Request("http://localhost/end-turn-simulation", {
        body: JSON.stringify({ expectedTurnNumber: 1, worldId: "world-1" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    const responseBody: unknown = await response.json();

    expect(response.status).toBe(501);
    expect(responseBody).toEqual({
      error: {
        code: "not_implemented",
        message: "end-turn-simulation is not yet wired",
      },
      ok: false,
    });
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("echoes the allowed Origin in access-control-allow-origin on the 501 response", () => {
    const response = handleEndTurnSimulationRequest(
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

    expect(response.status).toBe(501);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:5173",
    );
  });
});
