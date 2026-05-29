import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  redirectAuthenticatedRoute,
  requireAuthenticatedRoute,
} from "./protectedRouteGuards";

const { requireSupabaseClient } = vi.hoisted(() => ({
  requireSupabaseClient: vi.fn<() => unknown>(),
}));

vi.mock("@/lib/supabase", () => ({
  requireSupabaseClient,
  supabase: null,
}));

describe("requireAuthenticatedRoute", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    requireSupabaseClient.mockReturnValue({});
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("redirects unauthenticated users to sign-in", async () => {
    vi.spyOn(queryClient, "ensureQueryData").mockResolvedValue(null);

    await expect(
      requireAuthenticatedRoute({ queryClient, returnTo: "/worlds" }),
    ).resolves.toMatchObject({
      status: 307,
      options: {
        search: { returnTo: "/worlds" },
        to: "/sign-in",
      },
    });
  });

  it("normalizes unsafe return paths in the sign-in redirect", async () => {
    vi.spyOn(queryClient, "ensureQueryData").mockResolvedValue(null);

    await expect(
      requireAuthenticatedRoute({
        queryClient,
        returnTo: "https://evil.example.com",
      }),
    ).resolves.toMatchObject({
      status: 307,
      options: {
        search: { returnTo: "/worlds" },
        to: "/sign-in",
      },
    });
  });

  it("returns without redirecting when the user has an active session", async () => {
    vi.spyOn(queryClient, "ensureQueryData").mockResolvedValue({
      user: { id: "user-1" },
    });

    await expect(
      requireAuthenticatedRoute({ queryClient, returnTo: "/worlds" }),
    ).resolves.toBeUndefined();
  });
});

describe("redirectAuthenticatedRoute", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    requireSupabaseClient.mockReturnValue({});
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
  });

  it("redirects authenticated users away from auth pages", async () => {
    vi.spyOn(queryClient, "ensureQueryData").mockResolvedValue({
      user: { id: "user-1" },
    });

    await expect(
      redirectAuthenticatedRoute({ queryClient, returnTo: "/worlds" }),
    ).resolves.toMatchObject({
      status: 307,
      options: { href: "/worlds" },
    });
  });

  it("normalizes unsafe return paths when redirecting authenticated users", async () => {
    vi.spyOn(queryClient, "ensureQueryData").mockResolvedValue({
      user: { id: "user-1" },
    });

    await expect(
      redirectAuthenticatedRoute({
        queryClient,
        returnTo: "https://evil.example.com",
      }),
    ).resolves.toMatchObject({
      status: 307,
      options: { href: "/worlds" },
    });
  });

  it("returns without redirecting when there is no active session", async () => {
    vi.spyOn(queryClient, "ensureQueryData").mockResolvedValue(null);

    await expect(
      redirectAuthenticatedRoute({ queryClient, returnTo: "/worlds" }),
    ).resolves.toBeUndefined();
  });
});
