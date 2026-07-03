import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { constructionProjectsBySettlementQueryOptions } from "./constructionProjectsQueries";

const SETTLEMENT_ID = "11111111-1111-1111-1111-111111111111";
const PROJECT_ID = "22222222-2222-2222-2222-222222222222";
const BLUEPRINT_ID = "33333333-3333-3333-3333-333333333333";
const TIER_ID = "44444444-4444-4444-4444-444444444444";

type ProjectRow = {
  readonly activated_on_turn_number: number | null;
  readonly building_blueprint_id: string;
  readonly building_blueprint_tiers: {
    readonly tier_number: number;
    readonly worker_turns_required: number;
  };
  readonly building_blueprints: { readonly name: string };
  readonly completed_in_transition_id: string | null;
  readonly created_at: string;
  readonly id: string;
  readonly progress_worker_turns: number;
  readonly queue_position: number;
  readonly settlement_id: string;
  readonly status: string;
  readonly target_tier_id: string;
  readonly updated_at: string;
};

function createClient({
  rows,
  error = null,
}: {
  readonly rows: readonly ProjectRow[];
  readonly error?: { readonly code: string; readonly message: string } | null;
}): {
  readonly client: GubernatorSupabaseClient;
  readonly calls: {
    readonly select: ReturnType<typeof vi.fn>;
    readonly eq: ReturnType<typeof vi.fn>;
    readonly order: ReturnType<typeof vi.fn>;
  };
} {
  const returns = vi.fn().mockResolvedValue({ data: rows, error });
  const order = vi.fn(() => ({ returns }));
  const eq = vi.fn(() => ({ order }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  return {
    client: { from } as unknown as GubernatorSupabaseClient,
    calls: { select, eq, order },
  };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
}

describe("constructionProjectsBySettlementQueryOptions", () => {
  it("queries construction_projects scoped to the settlement, ordered by queue position", async () => {
    const { client, calls } = createClient({ rows: [] });
    const queryClient = createQueryClient();

    await queryClient.fetchQuery(
      constructionProjectsBySettlementQueryOptions(SETTLEMENT_ID, client),
    );

    expect(calls.eq).toHaveBeenCalledWith("settlement_id", SETTLEMENT_ID);
    expect(calls.order).toHaveBeenCalledWith("queue_position", {
      ascending: true,
    });
  });

  it("maps a row to a ConstructionProject", async () => {
    const row: ProjectRow = {
      activated_on_turn_number: 3,
      building_blueprint_id: BLUEPRINT_ID,
      building_blueprint_tiers: { tier_number: 2, worker_turns_required: 40 },
      building_blueprints: { name: "Granary" },
      completed_in_transition_id: null,
      created_at: "2024-01-01T00:00:00Z",
      id: PROJECT_ID,
      progress_worker_turns: 10,
      queue_position: 1,
      settlement_id: SETTLEMENT_ID,
      status: "in_progress",
      target_tier_id: TIER_ID,
      updated_at: "2024-01-02T00:00:00Z",
    };
    const { client } = createClient({ rows: [row] });
    const queryClient = createQueryClient();

    const result = await queryClient.fetchQuery(
      constructionProjectsBySettlementQueryOptions(SETTLEMENT_ID, client),
    );

    expect(result).toEqual([
      {
        activatedOnTurnNumber: 3,
        blueprintName: "Granary",
        buildingBlueprintId: BLUEPRINT_ID,
        completedInTransitionId: null,
        createdAt: "2024-01-01T00:00:00Z",
        id: PROJECT_ID,
        progressWorkerTurns: 10,
        queuePosition: 1,
        settlementId: SETTLEMENT_ID,
        status: "in_progress",
        targetTierId: TIER_ID,
        tierNumber: 2,
        updatedAt: "2024-01-02T00:00:00Z",
        workerTurnsRequired: 40,
      },
    ]);
  });

  it("uses a settlement-scoped query key", () => {
    const options = constructionProjectsBySettlementQueryOptions(
      SETTLEMENT_ID,
      {} as GubernatorSupabaseClient,
    );

    expect(options.queryKey).toContain(SETTLEMENT_ID);
  });

  it("normalizes a Supabase error", async () => {
    const { client } = createClient({
      rows: [],
      error: { code: "500", message: "boom" },
    });
    const queryClient = createQueryClient();

    await expect(
      queryClient.fetchQuery(
        constructionProjectsBySettlementQueryOptions(SETTLEMENT_ID, client),
      ),
    ).rejects.toThrow();
  });
});
