import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import { settlementTargetAssignmentsQueryOptions } from "./settlementTargetAssignmentsQueries";

describe("settlementTargetAssignmentsQueryOptions", () => {
  it("disambiguates deposit_types→job_definitions via named FK constraint", async () => {
    const returns = vi.fn().mockResolvedValue({ data: [], error: null });
    const order = vi.fn(() => ({ returns }));
    const inFn = vi.fn(() => ({ order }));
    const eq = vi.fn(() => ({ in: inFn }));
    const select = vi.fn(() => ({ eq }));
    const from = vi.fn(() => ({ select }));
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, retryDelay: 0 } },
    });

    await queryClient.fetchQuery(
      settlementTargetAssignmentsQueryOptions("settlement-1", client),
    );

    expect(select).toHaveBeenCalledWith(
      expect.stringContaining("deposit_types_job_id_fk"),
    );
  });
});
