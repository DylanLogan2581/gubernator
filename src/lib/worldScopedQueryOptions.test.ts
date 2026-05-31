import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { worldScopedQueryOptions } from "./worldScopedQueryOptions";

const mockClient = {} as GubernatorSupabaseClient;

describe("worldScopedQueryOptions", () => {
  it("passes the queryKey through", () => {
    const queryKey = ["test", "world-1"] as const;
    const opts = worldScopedQueryOptions({
      client: mockClient,
      queryKey,
      fetcher: vi.fn().mockResolvedValue([]),
    });
    expect(opts.queryKey).toEqual(queryKey);
  });

  it("invokes fetcher with the supplied client", async () => {
    const fetcher = vi.fn().mockResolvedValue("result");
    const opts = worldScopedQueryOptions({
      client: mockClient,
      queryKey: ["test"],
      fetcher,
    });

    const queryFn = opts.queryFn as () => Promise<unknown>;
    await queryFn();

    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher).toHaveBeenCalledWith(mockClient);
  });

  it("returns the fetcher result from queryFn", async () => {
    const expected = [{ id: "abc" }];
    const opts = worldScopedQueryOptions({
      client: mockClient,
      queryKey: ["test"],
      fetcher: vi.fn().mockResolvedValue(expected),
    });

    const queryFn = opts.queryFn as () => Promise<unknown>;
    const result = await queryFn();

    expect(result).toBe(expected);
  });
});
