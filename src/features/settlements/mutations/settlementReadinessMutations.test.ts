import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { AuthUiError } from "@/features/auth";
import { createAccessContext } from "@/features/permissions";
import type { WorldPermissionContext } from "@/features/worlds";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  isSetSettlementReadinessError,
  setSettlementReadinessMutationOptions,
} from "./settlementReadinessMutations";

describe("setSettlementReadinessMutationOptions", () => {
  it("sets one settlement ready and invalidates readiness list and summary queries", async () => {
    const clientFixture = createClient({
      updateResult: {
        data: {
          id: "settlement-1",
          is_ready_current_turn: true,
          ready_set_at: "2026-05-02T12:00:00.000Z",
        },
        error: null,
      },
    });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = setSettlementReadinessMutationOptions({
      accessContext: createAdminAccessContext(),
      client: clientFixture.client,
      queryClient,
    });

    const result = await executeMutation(queryClient, options, {
      isReady: true,
      settlementId: "settlement-1",
      worldId: "world-1",
    });

    expect(result).toEqual({
      id: "settlement-1",
      isReadyCurrentTurn: true,
      readySetAt: "2026-05-02T12:00:00.000Z",
    });
    expect(options.mutationKey).toEqual(["settlements", "set-readiness"]);
    expect(clientFixture.from).toHaveBeenCalledWith("settlements");
    expect(clientFixture.readSelect).toHaveBeenCalledWith(
      "id,nations!inner(world_id,worlds!inner(archived_at,id,owner_id,status,visibility))",
    );
    expect(clientFixture.readEqId).toHaveBeenCalledWith("id", "settlement-1");
    expect(clientFixture.readEqWorldId).toHaveBeenCalledWith(
      "nations.world_id",
      "world-1",
    );
    expect(clientFixture.update).toHaveBeenCalledWith({
      is_ready_current_turn: true,
      ready_set_at: "now",
    });
    expect(clientFixture.updateEq).toHaveBeenCalledWith("id", "settlement-1");
    expect(clientFixture.updateSelect).toHaveBeenCalledWith(
      "id,is_ready_current_turn,ready_set_at",
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["settlements", "readiness", "list", "world-1"],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["settlements", "readiness", "summary", "world-1"],
    });
  });

  it("clears one settlement readiness and ready_set_at", async () => {
    const clientFixture = createClient({
      updateResult: {
        data: {
          id: "settlement-1",
          is_ready_current_turn: false,
          ready_set_at: null,
        },
        error: null,
      },
    });
    const queryClient = createQueryClient();
    const options = setSettlementReadinessMutationOptions({
      accessContext: createAdminAccessContext(),
      client: clientFixture.client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        isReady: false,
        settlementId: "settlement-1",
        worldId: "world-1",
      }),
    ).resolves.toEqual({
      id: "settlement-1",
      isReadyCurrentTurn: false,
      readySetAt: null,
    });
    expect(clientFixture.update).toHaveBeenCalledWith({
      is_ready_current_turn: false,
      ready_set_at: null,
    });
  });

  it("returns an unauthorized error when access context cannot manage the settlement world", async () => {
    const clientFixture = createClient({
      readResult: {
        data: createAccessRow({
          owner_id: "user-2",
          visibility: "public",
        }),
        error: null,
      },
    });
    const queryClient = createQueryClient();
    const options = setSettlementReadinessMutationOptions({
      accessContext: createAccessContext({
        isSuperAdmin: false,
        userId: "user-1",
        worldAdminWorldIds: [],
      }),
      client: clientFixture.client,
      queryClient,
    });

    const mutationPromise = executeMutation(queryClient, options, {
      isReady: true,
      settlementId: "settlement-1",
      worldId: "world-1",
    });

    await expect(mutationPromise).rejects.toSatisfy(
      isSetSettlementReadinessError,
    );
    await expect(mutationPromise).rejects.toMatchObject({
      code: "settlement_readiness_unauthorized",
      message: "You do not have permission to update this settlement.",
      settlementId: "settlement-1",
      worldId: "world-1",
    });
    expect(clientFixture.update).not.toHaveBeenCalled();
  });

  it("returns an unauthorized error when RLS hides the settlement or world mismatch", async () => {
    const clientFixture = createClient({
      readResult: { data: null, error: null },
    });
    const queryClient = createQueryClient();
    const options = setSettlementReadinessMutationOptions({
      accessContext: createAdminAccessContext(),
      client: clientFixture.client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        isReady: true,
        settlementId: "settlement-1",
        worldId: "world-1",
      }),
    ).rejects.toMatchObject({
      code: "settlement_readiness_unauthorized",
      message: "You do not have permission to update this settlement.",
      settlementId: "settlement-1",
      worldId: "world-1",
    });
    expect(clientFixture.update).not.toHaveBeenCalled();
  });

  it("returns an archived-world error before writing", async () => {
    const clientFixture = createClient({
      readResult: {
        data: createAccessRow({
          archived_at: "2026-01-03T00:00:00.000Z",
          status: "archived",
        }),
        error: null,
      },
    });
    const queryClient = createQueryClient();
    const options = setSettlementReadinessMutationOptions({
      accessContext: createAdminAccessContext(),
      client: clientFixture.client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        isReady: true,
        settlementId: "settlement-1",
        worldId: "world-1",
      }),
    ).rejects.toMatchObject({
      code: "settlement_readiness_archived",
      message: "Archived worlds are read-only.",
      name: "SetSettlementReadinessError",
      settlementId: "settlement-1",
      worldId: "world-1",
    });
    expect(clientFixture.update).not.toHaveBeenCalled();
  });

  it("normalizes Supabase write errors", async () => {
    const queryClient = createQueryClient();
    const options = setSettlementReadinessMutationOptions({
      accessContext: createAdminAccessContext(),
      client: createClient({
        updateResult: {
          data: null,
          error: {
            code: "42501",
            message: "permission denied for table settlements",
          },
        },
      }).client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        isReady: true,
        settlementId: "settlement-1",
        worldId: "world-1",
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

type SetSettlementReadinessOptions = ReturnType<
  typeof setSettlementReadinessMutationOptions
>;
type SupabaseError = {
  readonly code?: string;
  readonly message: string;
};
type SupabaseResult<TData> =
  | {
      readonly data: TData;
      readonly error: null;
    }
  | {
      readonly data: null;
      readonly error: SupabaseError | null;
    };
type SettlementReadinessAccessRow = {
  readonly id: string;
  readonly nations: {
    readonly world_id: string;
    readonly worlds: SettlementReadinessWorldAccessRow;
  };
};
type SettlementReadinessWorldAccessRow = {
  readonly archived_at: string | null;
  readonly id: string;
  readonly owner_id: string;
  readonly status: string;
  readonly visibility: string;
};
type SettlementReadinessUpdateRow = {
  readonly id: string;
  readonly is_ready_current_turn: boolean;
  readonly ready_set_at: string | null;
};

function createClient({
  readResult = {
    data: createAccessRow(),
    error: null,
  },
  updateResult = {
    data: {
      id: "settlement-1",
      is_ready_current_turn: true,
      ready_set_at: "2026-05-02T12:00:00.000Z",
    },
    error: null,
  },
}: {
  readonly readResult?: SupabaseResult<SettlementReadinessAccessRow>;
  readonly updateResult?: SupabaseResult<SettlementReadinessUpdateRow>;
} = {}): {
  readonly client: GubernatorSupabaseClient;
  readonly from: ReturnType<typeof vi.fn>;
  readonly readEqId: ReturnType<typeof vi.fn>;
  readonly readEqWorldId: ReturnType<typeof vi.fn>;
  readonly readSelect: ReturnType<typeof vi.fn>;
  readonly update: ReturnType<typeof vi.fn>;
  readonly updateEq: ReturnType<typeof vi.fn>;
  readonly updateSelect: ReturnType<typeof vi.fn>;
} {
  const readMaybeSingle = vi.fn().mockResolvedValue(readResult);
  const readEqWorldId = vi.fn(() => ({ maybeSingle: readMaybeSingle }));
  const readEqId = vi.fn(() => ({ eq: readEqWorldId }));
  const readSelect = vi.fn(() => ({ eq: readEqId }));
  const updateMaybeSingle = vi.fn().mockResolvedValue(updateResult);
  const updateSelect = vi.fn(() => ({ maybeSingle: updateMaybeSingle }));
  const updateEq = vi.fn(() => ({ select: updateSelect }));
  const update = vi.fn(() => ({ eq: updateEq }));
  const from = vi.fn(() => ({ select: readSelect, update }));

  return {
    client: { from } as unknown as GubernatorSupabaseClient,
    from,
    readEqId,
    readEqWorldId,
    readSelect,
    update,
    updateEq,
    updateSelect,
  };
}

function createAccessRow(
  worldOverrides: Partial<SettlementReadinessWorldAccessRow> = {},
): SettlementReadinessAccessRow {
  return {
    id: "settlement-1",
    nations: {
      world_id: "world-1",
      worlds: {
        archived_at: null,
        id: "world-1",
        owner_id: "user-1",
        status: "active",
        visibility: "private",
        ...worldOverrides,
      },
    },
  };
}

function createAdminAccessContext(): WorldPermissionContext {
  return createAccessContext({
    isSuperAdmin: false,
    userId: "user-1",
    worldAdminWorldIds: [],
  });
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

function executeMutation(
  queryClient: QueryClient,
  options: SetSettlementReadinessOptions,
  variables: Parameters<
    NonNullable<SetSettlementReadinessOptions["mutationFn"]>
  >[0],
): Promise<unknown> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options)
    .execute(variables);
}
