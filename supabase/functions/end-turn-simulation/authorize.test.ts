import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveSupabaseEndTurnSimulationAuthorization } from "./authorize";

afterEach(() => {
  vi.unstubAllGlobals();
});

const WORLD_ID = "00000000-0000-0000-0000-000000000001";

function stubDenoEnv(): void {
  vi.stubGlobal("Deno", {
    env: {
      get: (name: string): string | undefined => {
        if (name === "SUPABASE_URL") return "http://localhost:54321";
        if (name === "SUPABASE_ANON_KEY") return "test-anon-key";
        return undefined;
      },
    },
  });
}

function stubFetch(
  responses: Record<string, { body: unknown; status: number }>,
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn((url: string): Promise<Response> => {
    const entry = Object.entries(responses).find(([pattern]) =>
      url.includes(pattern),
    );
    const { body, status } = entry?.[1] ?? {
      body: { error: `Unexpected fetch call: ${url}` },
      status: 500,
    };
    return Promise.resolve(new Response(JSON.stringify(body), { status }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("resolveSupabaseEndTurnSimulationAuthorization", () => {
  describe("super-admin path", () => {
    it("uses the user JWT (not a service-role key) for the world existence check", async () => {
      stubDenoEnv();
      const fetchMock = stubFetch({
        "rpc/is_super_admin": { body: true, status: 200 },
        "/rest/v1/worlds": { body: [{ id: WORLD_ID }], status: 200 },
      });

      const userJwt = "Bearer user-jwt-token";

      await resolveSupabaseEndTurnSimulationAuthorization(
        { expectedTurnNumber: 1, worldId: WORLD_ID },
        { authorizationHeader: userJwt, userId: "user-1" },
      );

      const worldsCall = (fetchMock.mock.calls as [string, RequestInit][]).find(
        ([url]) => url.includes("/rest/v1/worlds"),
      );

      expect(worldsCall).toBeDefined();
      if (worldsCall === undefined) throw new Error("worlds fetch not called");
      const headers = worldsCall[1].headers as Record<string, string>;
      expect(headers["authorization"]).toBe(userJwt);
      expect(headers["apikey"]).toBe("test-anon-key");
    });

    it("returns ok: true when the world exists and user is super admin", async () => {
      stubDenoEnv();
      stubFetch({
        "rpc/is_super_admin": { body: true, status: 200 },
        "/rest/v1/worlds": { body: [{ id: WORLD_ID }], status: 200 },
      });

      const result = await resolveSupabaseEndTurnSimulationAuthorization(
        { expectedTurnNumber: 1, worldId: WORLD_ID },
        { authorizationHeader: "Bearer user-jwt-token", userId: "user-1" },
      );

      expect(result.ok).toBe(true);
    });

    it("returns a 403 when super admin but world does not exist", async () => {
      stubDenoEnv();
      stubFetch({
        "rpc/is_super_admin": { body: true, status: 200 },
        "/rest/v1/worlds": { body: [], status: 200 },
      });

      const result = await resolveSupabaseEndTurnSimulationAuthorization(
        { expectedTurnNumber: 1, worldId: WORLD_ID },
        { authorizationHeader: "Bearer user-jwt-token", userId: "user-1" },
      );

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.status).toBe(403);
      }
    });
  });
});
