import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { AuthUiError } from "@/features/auth";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  WorldNpcFlavorConfigError,
  isWorldNpcFlavorConfigError,
  shouldRetryWorldNpcFlavorConfigQuery,
  worldNpcFlavorConfigQueryOptions,
} from "./worldNpcFlavorConfigQueries";

describe("worldNpcFlavorConfigQueryOptions", () => {
  it("loads and validates one RLS-visible world NPC flavor config", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { npc_flavor_config_json: createNpcFlavorConfig() },
      error: null,
    });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const queryClient = createQueryClient();

    const config = await queryClient.fetchQuery(
      worldNpcFlavorConfigQueryOptions("world-1", {
        from,
      } as unknown as GubernatorSupabaseClient),
    );

    expect(config).toEqual(createNpcFlavorConfig());
    expect(from).toHaveBeenCalledWith("worlds");
    expect(select).toHaveBeenCalledWith("npc_flavor_config_json");
    expect(eq).toHaveBeenCalledWith("id", "world-1");
    expect(maybeSingle).toHaveBeenCalledWith();
  });

  it("uses world-scoped query keys", () => {
    const options = worldNpcFlavorConfigQueryOptions(
      "world-1",
      {} as GubernatorSupabaseClient,
    );

    expect(options.queryKey).toEqual([
      "worlds",
      "npc-flavor-config",
      "world-1",
    ]);
  });

  it("returns a UI-safe error when the config is invalid", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        npc_flavor_config_json: {
          traits: [42],
          contradictions: [],
          goals: [],
          flaws: [],
        },
      },
      error: null,
    });
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        worldNpcFlavorConfigQueryOptions(
          "world-1",
          createClient({ maybeSingle }),
        ),
      ),
    ).rejects.toMatchObject({
      code: "world_npc_flavor_config_invalid",
      message: "NPC flavor configuration is invalid.",
      name: "WorldNpcFlavorConfigError",
      worldId: "world-1",
    });
  });

  it("returns a UI-safe error when RLS hides the world or the config is missing", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        worldNpcFlavorConfigQueryOptions(
          "world-1",
          createClient({ maybeSingle }),
        ),
      ),
    ).rejects.toMatchObject({
      code: "world_npc_flavor_config_missing",
      message: "NPC flavor configuration is unavailable.",
      name: "WorldNpcFlavorConfigError",
      worldId: "world-1",
    });
  });

  it("returns a UI-safe error when the config column value is missing", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { npc_flavor_config_json: null },
      error: null,
    });
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        worldNpcFlavorConfigQueryOptions(
          "world-1",
          createClient({ maybeSingle }),
        ),
      ),
    ).rejects.toSatisfy(isWorldNpcFlavorConfigError);
  });

  it("normalizes Supabase errors", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "42501",
        message: "permission denied for table worlds",
      },
    });
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        worldNpcFlavorConfigQueryOptions(
          "world-1",
          createClient({ maybeSingle }),
        ),
      ),
    ).rejects.toMatchObject({
      code: "42501",
      message: "permission denied for table worlds",
      name: "AuthUiError",
    });
  });

  it("does not retry invalid or missing NPC flavor config results", () => {
    expect(
      shouldRetryWorldNpcFlavorConfigQuery(
        0,
        new WorldNpcFlavorConfigError({
          code: "world_npc_flavor_config_invalid",
          message: "NPC flavor configuration is invalid.",
          worldId: "world-1",
        }),
      ),
    ).toBe(false);
    expect(
      shouldRetryWorldNpcFlavorConfigQuery(0, new AuthUiError({ message: "" })),
    ).toBe(true);
    expect(
      shouldRetryWorldNpcFlavorConfigQuery(3, new AuthUiError({ message: "" })),
    ).toBe(false);
  });
});

function createClient({
  maybeSingle,
}: {
  readonly maybeSingle: ReturnType<typeof vi.fn>;
}): GubernatorSupabaseClient {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle })),
      })),
    })),
  } as unknown as GubernatorSupabaseClient;
}

function createNpcFlavorConfig(): {
  readonly traits: readonly ["earnest", "wry"];
  readonly contradictions: readonly ["mourns a friend they betrayed"];
  readonly goals: readonly ["a seat on the council"];
  readonly flaws: readonly ["pride"];
} {
  return {
    traits: ["earnest", "wry"],
    contradictions: ["mourns a friend they betrayed"],
    goals: ["a seat on the council"],
    flaws: ["pride"],
  };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0 },
    },
  });
}
