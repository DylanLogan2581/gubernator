import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { AuthUiError } from "@/features/auth";
import { createAccessContext } from "@/features/permissions";
import type { WorldPermissionContext } from "@/features/worlds";
import { npcFlavorInputLimits } from "@/lib/inputLimits";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  isSaveWorldNpcFlavorConfigError,
  saveWorldNpcFlavorConfigMutationOptions,
} from "./worldNpcFlavorConfigMutations";

const WORLD_ID = "11111111-1111-1111-1111-111111111111";
const OWNER_ID = "22222222-2222-2222-2222-222222222222";
const OTHER_USER_ID = "33333333-3333-3333-3333-333333333333";

type AccessRow = {
  readonly archived_at: string | null;
  readonly id: string;
  readonly owner_id: string;
  readonly status: string;
  readonly visibility: string;
};

type SupabaseError = { readonly code?: string; readonly message: string };
type SupabaseResult<TData> =
  | { readonly data: TData; readonly error: null }
  | { readonly data: null; readonly error: SupabaseError | null };

function createAccessRow(overrides: Partial<AccessRow> = {}): AccessRow {
  return {
    archived_at: null,
    id: WORLD_ID,
    owner_id: OWNER_ID,
    status: "active",
    visibility: "private",
    ...overrides,
  };
}

function createClient({
  readResult = { data: createAccessRow(), error: null },
  updateResult = { data: { id: WORLD_ID }, error: null },
}: {
  readonly readResult?: SupabaseResult<AccessRow>;
  readonly updateResult?: SupabaseResult<{ readonly id: string }>;
} = {}): {
  readonly client: GubernatorSupabaseClient;
  readonly from: ReturnType<typeof vi.fn>;
  readonly readSelect: ReturnType<typeof vi.fn>;
  readonly updateUpdate: ReturnType<typeof vi.fn>;
  readonly updateEqId: ReturnType<typeof vi.fn>;
  readonly updateEqStatus: ReturnType<typeof vi.fn>;
  readonly updateSelect: ReturnType<typeof vi.fn>;
} {
  const readMaybeSingle = vi.fn().mockResolvedValue(readResult);
  const readEqId = vi.fn(() => ({ maybeSingle: readMaybeSingle }));
  const readSelect = vi.fn(() => ({ eq: readEqId }));
  const readFrom = { select: readSelect };

  const updateMaybeSingle = vi.fn().mockResolvedValue(updateResult);
  const updateSelect = vi.fn(() => ({ maybeSingle: updateMaybeSingle }));
  const updateEqStatus = vi.fn(() => ({ select: updateSelect }));
  const updateEqId = vi.fn(() => ({ eq: updateEqStatus }));
  const updateUpdate = vi.fn(() => ({ eq: updateEqId }));
  const updateFrom = { update: updateUpdate };

  const from = vi
    .fn()
    .mockReturnValueOnce(readFrom)
    .mockReturnValueOnce(updateFrom);

  return {
    client: { from } as unknown as GubernatorSupabaseClient,
    from,
    readSelect,
    updateUpdate,
    updateEqId,
    updateEqStatus,
    updateSelect,
  };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

type SaveWorldNpcFlavorConfigOptions = ReturnType<
  typeof saveWorldNpcFlavorConfigMutationOptions
>;

function executeMutation(
  queryClient: QueryClient,
  options: SaveWorldNpcFlavorConfigOptions,
  variables: Parameters<
    NonNullable<SaveWorldNpcFlavorConfigOptions["mutationFn"]>
  >[0],
): Promise<unknown> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options)
    .execute(variables);
}

function createOwnerAccessContext(): WorldPermissionContext {
  return createAccessContext({
    isSuperAdmin: false,
    userId: OWNER_ID,
    worldAdminWorldIds: [],
  });
}

function createNonAdminAccessContext(): WorldPermissionContext {
  return createAccessContext({
    isSuperAdmin: false,
    userId: OTHER_USER_ID,
    worldAdminWorldIds: [],
  });
}

const validConfig = {
  contradictions: ["Fears commitment but seeks validation"],
  flaws: ["Impulsive"],
  goals: ["Find purpose"],
  traits: ["Charismatic", "Restless"],
};

describe("saveWorldNpcFlavorConfigMutationOptions", () => {
  it("writes to the DB and returns the config when canAdminWorld is true", async () => {
    const { client, from, updateUpdate, updateEqId, updateEqStatus } =
      createClient();
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = saveWorldNpcFlavorConfigMutationOptions({
      accessContext: createOwnerAccessContext(),
      client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      config: validConfig,
      worldId: WORLD_ID,
    });

    expect(result).toEqual(validConfig);
    expect(from).toHaveBeenNthCalledWith(1, "worlds");
    expect(from).toHaveBeenNthCalledWith(2, "worlds");
    expect(updateUpdate).toHaveBeenCalledWith({
      npc_flavor_config_json: validConfig,
    });
    expect(updateEqId).toHaveBeenCalledWith("id", WORLD_ID);
    expect(updateEqStatus).toHaveBeenCalledWith("status", "active");
    expect(options.mutationKey).toEqual([
      "worlds",
      "save-world-npc-flavor-config",
    ]);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["worlds"],
    });
  });

  it("returns unauthorized and does not call update when canAdminWorld is false", async () => {
    const { client, updateUpdate } = createClient();
    const queryClient = createQueryClient();
    const options = saveWorldNpcFlavorConfigMutationOptions({
      accessContext: createNonAdminAccessContext(),
      client,
      queryClient,
    });

    const result = executeMutation(queryClient, options, {
      config: validConfig,
      worldId: WORLD_ID,
    });

    await expect(result).rejects.toSatisfy(isSaveWorldNpcFlavorConfigError);
    await expect(result).rejects.toMatchObject({
      code: "world_npc_flavor_config_unauthorized",
      worldId: WORLD_ID,
    });
    expect(updateUpdate).not.toHaveBeenCalled();
  });

  it("returns unauthorized and does not call update when the world is not found", async () => {
    const { client, updateUpdate } = createClient({
      readResult: { data: null, error: null },
    });
    const queryClient = createQueryClient();
    const options = saveWorldNpcFlavorConfigMutationOptions({
      accessContext: createOwnerAccessContext(),
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        config: validConfig,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({
      code: "world_npc_flavor_config_unauthorized",
      worldId: WORLD_ID,
    });
    expect(updateUpdate).not.toHaveBeenCalled();
  });

  it("rejects invalid config schema before touching the DB", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = saveWorldNpcFlavorConfigMutationOptions({
      accessContext: createOwnerAccessContext(),
      client,
      queryClient,
    });

    const result = executeMutation(queryClient, options, {
      config: { contradictions: [], flaws: [], goals: [] },
      worldId: WORLD_ID,
    });

    await expect(result).rejects.toSatisfy(isSaveWorldNpcFlavorConfigError);
    await expect(result).rejects.toMatchObject({
      code: "world_npc_flavor_config_invalid",
      worldId: WORLD_ID,
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects a pool that exceeds the maximum entry count", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = saveWorldNpcFlavorConfigMutationOptions({
      accessContext: createOwnerAccessContext(),
      client,
      queryClient,
    });

    const oversizedPool = Array.from(
      { length: npcFlavorInputLimits.poolSizeMax + 1 },
      (_, i) => `entry-${i}`,
    );

    await expect(
      executeMutation(queryClient, options, {
        config: {
          contradictions: oversizedPool,
          flaws: [],
          goals: [],
          traits: [],
        },
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "world_npc_flavor_config_invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("rejects a pool entry that exceeds the maximum entry length", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = saveWorldNpcFlavorConfigMutationOptions({
      accessContext: createOwnerAccessContext(),
      client,
      queryClient,
    });

    const tooLongEntry = "x".repeat(npcFlavorInputLimits.poolEntryMax + 1);

    await expect(
      executeMutation(queryClient, options, {
        config: {
          contradictions: [],
          flaws: [tooLongEntry],
          goals: [],
          traits: [],
        },
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "world_npc_flavor_config_invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns archived error when world status is archived", async () => {
    const { client, updateUpdate } = createClient({
      readResult: {
        data: createAccessRow({ status: "archived", archived_at: null }),
        error: null,
      },
    });
    const queryClient = createQueryClient();
    const options = saveWorldNpcFlavorConfigMutationOptions({
      accessContext: createOwnerAccessContext(),
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        config: validConfig,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({
      code: "world_npc_flavor_config_archived",
      worldId: WORLD_ID,
    });
    expect(updateUpdate).not.toHaveBeenCalled();
  });

  it("returns archived error when archived_at is set", async () => {
    const { client, updateUpdate } = createClient({
      readResult: {
        data: createAccessRow({
          archived_at: "2026-01-01T00:00:00.000Z",
          status: "active",
        }),
        error: null,
      },
    });
    const queryClient = createQueryClient();
    const options = saveWorldNpcFlavorConfigMutationOptions({
      accessContext: createOwnerAccessContext(),
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        config: validConfig,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({
      code: "world_npc_flavor_config_archived",
      worldId: WORLD_ID,
    });
    expect(updateUpdate).not.toHaveBeenCalled();
  });

  it("returns unauthorized when the update returns null", async () => {
    const { client } = createClient({
      updateResult: { data: null, error: null },
    });
    const queryClient = createQueryClient();
    const options = saveWorldNpcFlavorConfigMutationOptions({
      accessContext: createOwnerAccessContext(),
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        config: validConfig,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({
      code: "world_npc_flavor_config_unauthorized",
      worldId: WORLD_ID,
    });
  });

  it("normalizes Supabase errors from the read query", async () => {
    const readMaybeSingle = vi.fn().mockResolvedValue({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const readEqId = vi.fn(() => ({ maybeSingle: readMaybeSingle }));
    const readSelect = vi.fn(() => ({ eq: readEqId }));
    const from = vi.fn(() => ({ select: readSelect }));
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = saveWorldNpcFlavorConfigMutationOptions({
      accessContext: createOwnerAccessContext(),
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        config: validConfig,
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });

  it("normalizes Supabase errors from the update query", async () => {
    const { client } = createClient({
      updateResult: {
        data: null,
        error: { code: "42501", message: "permission denied" },
      },
    });
    const queryClient = createQueryClient();
    const options = saveWorldNpcFlavorConfigMutationOptions({
      accessContext: createOwnerAccessContext(),
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        config: validConfig,
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});
