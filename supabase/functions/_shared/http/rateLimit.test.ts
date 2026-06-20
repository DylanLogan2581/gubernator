import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkRateLimit } from "./rateLimit.ts";

const SUPABASE_URL = "https://example.supabase.co";
const SERVICE_ROLE_KEY = "test-service-role-key";

const mockFetch = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", mockFetch);
  vi.stubGlobal("Deno", {
    env: {
      get: (key: string) => {
        const env: Record<string, string> = {
          SUPABASE_URL,
          SUPABASE_ANON_KEY: "test-anon-key",
          SUPABASE_SERVICE_ROLE_KEY: SERVICE_ROLE_KEY,
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

function makeRpcResponse(count: number, status = 200): Response {
  return new Response(JSON.stringify(count), { status });
}

describe("checkRateLimit", () => {
  describe("ok: within limit", () => {
    it("returns ok:true when count is under the limit", async () => {
      mockFetch.mockResolvedValueOnce(makeRpcResponse(1));

      const result = await checkRateLimit("user-123", "admin-create-user", 10);

      expect(result.ok).toBe(true);
    });

    it("returns ok:true when count equals the limit", async () => {
      mockFetch.mockResolvedValueOnce(makeRpcResponse(10));

      const result = await checkRateLimit("user-123", "admin-create-user", 10);

      expect(result.ok).toBe(true);
    });

    it("calls increment_rate_limit_bucket RPC with service_role credentials", async () => {
      mockFetch.mockResolvedValueOnce(makeRpcResponse(1));

      await checkRateLimit("user-abc", "end-turn-simulation", 10);

      expect(mockFetch).toHaveBeenCalledOnce();
      const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toContain("rpc/increment_rate_limit_bucket");
      expect(url).toContain(SUPABASE_URL);

      const headers = init.headers as Record<string, string>;
      expect(headers.authorization).toBe(`Bearer ${SERVICE_ROLE_KEY}`);
      expect(headers.apikey).toBe(SERVICE_ROLE_KEY);

      const body = JSON.parse(init.body as string) as Record<string, unknown>;
      expect(body.p_user_id).toBe("user-abc");
      expect(body.p_function_name).toBe("end-turn-simulation");
      expect(typeof body.p_window_minute).toBe("string");
    });
  });

  describe("429: limit exceeded", () => {
    it("returns ok:false with retryAfterSeconds when count exceeds limit", async () => {
      mockFetch.mockResolvedValueOnce(makeRpcResponse(11));

      const result = await checkRateLimit("user-123", "admin-create-user", 10);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.retryAfterSeconds).toBeGreaterThan(0);
        expect(result.retryAfterSeconds).toBeLessThanOrEqual(60);
      }
    });

    it("returns ok:false when count is well above limit", async () => {
      mockFetch.mockResolvedValueOnce(makeRpcResponse(100));

      const result = await checkRateLimit("user-123", "end-turn-simulation", 10);

      expect(result.ok).toBe(false);
    });
  });

  describe("fail-open behavior", () => {
    it("returns ok:true when RPC responds with non-200", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "permission denied" }), {
          status: 403,
        }),
      );

      const result = await checkRateLimit("user-123", "admin-create-user", 10);

      expect(result.ok).toBe(true);
    });

    it("returns ok:true when RPC returns non-number", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ count: 5 }), { status: 200 }),
      );

      const result = await checkRateLimit("user-123", "admin-create-user", 10);

      expect(result.ok).toBe(true);
    });

    it("returns ok:true when fetch throws (network error)", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await checkRateLimit("user-123", "admin-create-user", 10);

      expect(result.ok).toBe(true);
    });

    it("returns ok:true when SUPABASE_SERVICE_ROLE_KEY is missing", async () => {
      vi.stubGlobal("Deno", {
        env: {
          get: (key: string) => {
            if (key === "SUPABASE_URL") return SUPABASE_URL;
            return undefined;
          },
        },
      });

      const result = await checkRateLimit("user-123", "admin-create-user", 10);

      expect(result.ok).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns ok:true when SUPABASE_URL is missing", async () => {
      vi.stubGlobal("Deno", {
        env: {
          get: (key: string) => {
            if (key === "SUPABASE_SERVICE_ROLE_KEY") return SERVICE_ROLE_KEY;
            return undefined;
          },
        },
      });

      const result = await checkRateLimit("user-123", "admin-create-user", 10);

      expect(result.ok).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
