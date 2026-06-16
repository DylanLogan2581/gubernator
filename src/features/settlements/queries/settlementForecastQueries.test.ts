import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { settlementForecastQueryOptions } from "./settlementForecastQueries";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
}));

// -- settlementForecastQueryOptions --

describe("settlementForecastQueryOptions", () => {
  it("returns refetchOnWindowFocus false", () => {
    const opts = settlementForecastQueryOptions("world-1", createClient(null));

    expect(opts.refetchOnWindowFocus).toBe(false);
  });

  it("returns staleTime of 5 minutes", () => {
    const opts = settlementForecastQueryOptions("world-1", createClient(null));

    expect(opts.staleTime).toBe(5 * 60 * 1000);
  });

  it("returns gcTime of 10 minutes", () => {
    const opts = settlementForecastQueryOptions("world-1", createClient(null));

    expect(opts.gcTime).toBe(10 * 60 * 1000);
  });

  it("returns null when edge function returns null response", async () => {
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      settlementForecastQueryOptions("world-1", createClient(null)),
    );

    expect(result).toBeNull();
  });

  it("returns forecastSnapshot when edge function returns valid response", async () => {
    const snapshot = { bySettlement: {} };
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      settlementForecastQueryOptions("world-1", createClient(snapshot)),
    );

    expect(result).toEqual({ forecastSnapshot: snapshot });
  });

  it("returns null when snapshot fails schema validation", async () => {
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      settlementForecastQueryOptions(
        "world-1",
        createClient({ notBySettlement: "invalid" }),
      ),
    );

    expect(result).toBeNull();
  });
});

// -- Helpers --

function createClient(forecastSnapshot: unknown): GubernatorSupabaseClient {
  const data =
    forecastSnapshot === null ? null : { data: { forecastSnapshot }, ok: true };

  return {
    functions: {
      invoke: vi.fn().mockResolvedValue({ data, error: null }),
    },
  } as unknown as GubernatorSupabaseClient;
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0 },
    },
  });
}
