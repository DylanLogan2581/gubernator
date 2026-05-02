import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { settlementReadinessListQueryOptions } from "./settlementReadinessQueries";

describe("settlementReadinessListQueryOptions", () => {
  it("loads settlement readiness rows for one RLS-visible world", async () => {
    const from = vi.fn(() =>
      createSettlementReadinessQueryBuilder([
        {
          auto_ready_enabled: true,
          id: "settlement-1",
          is_ready_current_turn: false,
          name: "Amberhold",
          nation_id: "nation-1",
          ready_set_at: null,
        },
        {
          auto_ready_enabled: false,
          id: "settlement-2",
          is_ready_current_turn: true,
          name: "Briarwatch",
          nation_id: "nation-2",
          ready_set_at: "2026-05-02T12:00:00.000Z",
        },
      ]),
    );
    const queryClient = createQueryClient();

    const rows = await queryClient.fetchQuery(
      settlementReadinessListQueryOptions("world-1", {
        from,
      } as unknown as GubernatorSupabaseClient),
    );

    expect(rows).toEqual([
      {
        autoReadyEnabled: true,
        id: "settlement-1",
        isReadyCurrentTurn: false,
        name: "Amberhold",
        nationId: "nation-1",
        readySetAt: null,
      },
      {
        autoReadyEnabled: false,
        id: "settlement-2",
        isReadyCurrentTurn: true,
        name: "Briarwatch",
        nationId: "nation-2",
        readySetAt: "2026-05-02T12:00:00.000Z",
      },
    ]);
    expect(from).toHaveBeenCalledWith("settlements");
  });

  it("uses world-scoped query keys", () => {
    const options = settlementReadinessListQueryOptions(
      "world-1",
      {} as GubernatorSupabaseClient,
    );

    expect(options.queryKey).toEqual([
      "settlements",
      "readiness",
      "list",
      "world-1",
    ]);
  });

  it("selects only list and summary readiness fields and scopes through nations", async () => {
    const builder = createSettlementReadinessQueryBuilder([]);
    const from = vi.fn(() => builder);
    const queryClient = createQueryClient();

    await queryClient.fetchQuery(
      settlementReadinessListQueryOptions("world-1", {
        from,
      } as unknown as GubernatorSupabaseClient),
    );

    expect(builder.select).toHaveBeenCalledWith(
      "id,name,nation_id,auto_ready_enabled,is_ready_current_turn,ready_set_at,nations!inner()",
    );
    expect(builder.eq).toHaveBeenCalledWith("nations.world_id", "world-1");
    expect(builder.order).toHaveBeenCalledWith("name", { ascending: true });
    expect(builder.order).toHaveBeenCalledWith("id", { ascending: true });
  });

  it("returns an empty list for a visible world without settlements", async () => {
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        settlementReadinessListQueryOptions(
          "world-empty",
          createClient({ rows: [] }),
        ),
      ),
    ).resolves.toEqual([]);
  });

  it("returns an empty list when RLS hides unauthorized world rows", async () => {
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        settlementReadinessListQueryOptions(
          "world-restricted",
          createClient({ rows: [] }),
        ),
      ),
    ).resolves.toEqual([]);
  });

  it("normalizes Supabase errors", async () => {
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        settlementReadinessListQueryOptions(
          "world-1",
          createClient({
            error: {
              code: "42501",
              message: "permission denied for table settlements",
            },
            rows: null,
          }),
        ),
      ),
    ).rejects.toMatchObject({
      code: "42501",
      message: "permission denied for table settlements",
      name: "AuthUiError",
    });
  });
});

type TestSettlementReadinessRow = {
  readonly auto_ready_enabled: boolean;
  readonly id: string;
  readonly is_ready_current_turn: boolean;
  readonly name: string;
  readonly nation_id: string;
  readonly ready_set_at: string | null;
};

function createClient({
  error = null,
  rows,
}: {
  readonly error?: { readonly code: string; readonly message: string } | null;
  readonly rows: readonly TestSettlementReadinessRow[] | null;
}): GubernatorSupabaseClient {
  return {
    from: vi.fn(() => createSettlementReadinessQueryBuilder(rows, error)),
  } as unknown as GubernatorSupabaseClient;
}

function createSettlementReadinessQueryBuilder(
  rows: readonly TestSettlementReadinessRow[] | null,
  error: { readonly code: string; readonly message: string } | null = null,
): {
  readonly eq: ReturnType<typeof vi.fn>;
  readonly order: ReturnType<typeof vi.fn>;
  readonly returns: ReturnType<typeof vi.fn>;
  readonly select: ReturnType<typeof vi.fn>;
} {
  const builder = {
    eq: vi.fn(),
    order: vi.fn(),
    returns: vi.fn(),
    select: vi.fn(),
  };
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockReturnValue(builder);
  builder.returns.mockResolvedValue({ data: rows, error });

  return builder;
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, retryDelay: 0 },
    },
  });
}
