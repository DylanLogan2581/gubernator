import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { AuthUiError } from "../utils/authErrors";

import {
  currentAppUserQueryOptions,
  currentSessionQueryOptions,
} from "./authQueries";
import { authQueryKeys } from "./authQueryKeys";

import type { AppUser } from "../types/authTypes";
import type { Session } from "@supabase/supabase-js";

describe("auth query options", () => {
  it("exposes a current session query", async () => {
    const session = createSession("user-1");
    const client = createClient({
      getSession: vi.fn().mockResolvedValue({
        data: { session },
        error: null,
      }),
    });
    const queryClient = createQueryClient();

    const options = currentSessionQueryOptions(client);

    await expect(queryClient.fetchQuery(options)).resolves.toBe(session);
    expect(options.queryKey).toEqual(authQueryKeys.currentSession());
  });

  it("normalizes current session query errors", async () => {
    const client = createClient({
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: { message: "Session lookup failed." },
      }),
    });
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(currentSessionQueryOptions(client)),
    ).rejects.toBeInstanceOf(AuthUiError);
  });

  it("returns null for current app user when signed out", async () => {
    const from = vi.fn();
    const client = createClient({
      from,
      getSession: vi.fn().mockResolvedValue({
        data: { session: null },
        error: null,
      }),
    });
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(currentAppUserQueryOptions(client)),
    ).resolves.toBeNull();
    expect(from).not.toHaveBeenCalled();
  });

  it("resolves the current app user from the active session", async () => {
    const appUser = createAppUser("user-1");
    const maybeSingle = vi
      .fn()
      .mockResolvedValue({ data: appUser, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ select });
    const client = createClient({
      from,
      getSession: vi.fn().mockResolvedValue({
        data: { session: createSession("user-1") },
        error: null,
      }),
    });
    const queryClient = createQueryClient();

    const options = currentAppUserQueryOptions(client);

    await expect(queryClient.fetchQuery(options)).resolves.toBe(appUser);
    expect(options.queryKey).toEqual(authQueryKeys.currentAppUser());
    expect(from).toHaveBeenCalledWith("users");
    expect(eq).toHaveBeenCalledWith("id", "user-1");
  });

  it("normalizes current app user query errors", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "PGRST000", message: "Profile lookup failed." },
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    const client = createClient({
      from: vi.fn().mockReturnValue({ select }),
      getSession: vi.fn().mockResolvedValue({
        data: { session: createSession("user-1") },
        error: null,
      }),
    });
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(currentAppUserQueryOptions(client)),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

function createClient(client: {
  readonly from?: unknown;
  readonly getSession: () => Promise<unknown>;
}): GubernatorSupabaseClient {
  return {
    auth: {
      getSession: client.getSession,
    },
    from: client.from,
  } as GubernatorSupabaseClient;
}

function createSession(userId: string): Session {
  return {
    user: { id: userId },
  } as Session;
}

function createAppUser(id: string): AppUser {
  return {
    created_at: "2026-04-26T00:00:00.000Z",
    email: `${id}@example.com`,
    id,
    is_super_admin: false,
    status: "active",
    updated_at: "2026-04-26T00:00:00.000Z",
    username: id,
  };
}
