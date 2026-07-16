import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { settlementTargetAssignmentsQueryOptions } from "./settlementTargetAssignmentsQueries";

describe("settlementTargetAssignmentsQueryOptions", () => {
  function buildClient(): {
    client: GubernatorSupabaseClient;
    select: ReturnType<typeof vi.fn>;
  } {
    const returns = vi.fn().mockResolvedValue({ data: [], error: null });
    const order = vi.fn(() => ({ returns }));
    const inFn = vi.fn(() => ({ order }));
    const eq = vi.fn(() => ({ in: inFn }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    return { client: { from } as unknown as GubernatorSupabaseClient, select };
  }

  it("embeds deposit_types without the dropped single-job FK (#1246)", async () => {
    const { client, select } = buildClient();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, retryDelay: 0 } },
    });

    await queryClient.fetchQuery(
      settlementTargetAssignmentsQueryOptions("settlement-1", client),
    );

    expect(select).toHaveBeenCalledWith(
      expect.stringContaining("deposit_instances(id,name,deposit_types(name))"),
    );
    expect(select).toHaveBeenCalledWith(
      expect.not.stringContaining("deposit_types_job_id_fk"),
    );
  });

  it("embeds trade_route_legs instead of removed resources FK", async () => {
    const { client, select } = buildClient();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, retryDelay: 0 } },
    });

    await queryClient.fetchQuery(
      settlementTargetAssignmentsQueryOptions("settlement-1", client),
    );

    const selectArg = (select.mock.calls[0] as unknown[])[0] as string;
    expect(selectArg).toContain(
      "trade_route_legs(direction,resource:resources(name))",
    );
  });
});
