import { describe, expect, it } from "vitest";

import { parseEndTurnSimulationRequestBody } from "./validate";

const VALID_UUID = "00000000-0000-0000-0000-000000000001";

function makeRequest(body: unknown, headers?: Record<string, string>): Request {
  const defaultHeaders = {
    "content-type": "application/json",
    ...headers,
  };
  return new Request("http://localhost/", {
    body: JSON.stringify(body),
    method: "POST",
    headers: defaultHeaders,
  });
}

describe("parseEndTurnSimulationRequestBody", () => {
  it("accepts a valid request", async () => {
    const result = await parseEndTurnSimulationRequestBody(
      makeRequest({ expectedTurnNumber: 1, worldId: VALID_UUID }),
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a non-UUID worldId with invalid_request", async () => {
    const result = await parseEndTurnSimulationRequestBody(
      makeRequest({ expectedTurnNumber: 1, worldId: "not-a-uuid" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error.code).toBe("invalid_request");
      expect(result.error.error.details).toContain("worldId");
    }
  });

  it("rejects an empty worldId with invalid_request", async () => {
    const result = await parseEndTurnSimulationRequestBody(
      makeRequest({ expectedTurnNumber: 1, worldId: "" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error.code).toBe("invalid_request");
      expect(result.error.error.details).toContain("worldId");
    }
  });

  it("rejects missing worldId", async () => {
    const result = await parseEndTurnSimulationRequestBody(
      makeRequest({ expectedTurnNumber: 1 }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error.code).toBe("invalid_request");
    }
  });

  it("rejects invalid body JSON with invalid_request", async () => {
    const req = new Request("http://localhost/", {
      body: "not json",
      method: "POST",
    });
    const result = await parseEndTurnSimulationRequestBody(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error.code).toBe("invalid_request");
    }
  });

  it("rejects non-JSON Content-Type", async () => {
    const result = await parseEndTurnSimulationRequestBody(
      makeRequest(
        { expectedTurnNumber: 1, worldId: VALID_UUID },
        { "content-type": "text/plain" },
      ),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error.code).toBe("invalid_request");
    }
  });

  it("rejects missing Content-Type header", async () => {
    const req = new Request("http://localhost/", {
      body: JSON.stringify({ expectedTurnNumber: 1, worldId: VALID_UUID }),
      method: "POST",
      headers: {},
    });
    const result = await parseEndTurnSimulationRequestBody(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error.code).toBe("invalid_request");
    }
  });

  it("rejects request body exceeding max size", async () => {
    const req = new Request("http://localhost/", {
      body: JSON.stringify({ expectedTurnNumber: 1, worldId: VALID_UUID }),
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": String(1024 * 11), // 11 KB, exceeds 10 KB limit
      },
    });
    const result = await parseEndTurnSimulationRequestBody(req);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error.code).toBe("invalid_request");
    }
  });
});
