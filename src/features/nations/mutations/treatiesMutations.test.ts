import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  breakTreatyMutationOptions,
  isNationTreatyMutationError,
  NationTreatyMutationError,
  proposeTreatyMutationOptions,
  respondToTreatyMutationOptions,
  withdrawTreatyMutationOptions,
} from "./treatiesMutations";

import type { NationTreatyRow } from "../queries/treatiesQueries";

const PROPOSER_NATION_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const RESPONDER_NATION_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const TREATY_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const WORLD_ID = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const CITIZEN_ID = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
const CITIZEN_B_ID = "ffffffff-ffff-ffff-ffff-ffffffffffff";
const RESOURCE_ID = "11111111-1111-1111-1111-111111111111";

describe("proposeTreatyMutationOptions", () => {
  it("calls propose_nation_treaty with snake_case tribute terms", async () => {
    const row = createTreatyRow({
      terms: {
        payer: "proposer",
        quantity_per_turn: 20,
        resource_id: RESOURCE_ID,
      },
      treaty_type: "tribute",
    });
    const { client, rpc } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = proposeTreatyMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      proposedByCitizenId: CITIZEN_ID,
      proposerNationId: PROPOSER_NATION_ID,
      responderNationId: RESPONDER_NATION_ID,
      terms: {
        payer: "proposer",
        quantityPerTurn: 20,
        resourceId: RESOURCE_ID,
      },
      treatyType: "tribute",
    });

    expect(rpc).toHaveBeenCalledWith("propose_nation_treaty", {
      p_duration_turns: undefined,
      p_proposed_by_citizen_id: CITIZEN_ID,
      p_proposer_nation_id: PROPOSER_NATION_ID,
      p_responder_nation_id: RESPONDER_NATION_ID,
      p_terms: {
        payer: "proposer",
        quantity_per_turn: 20,
        resource_id: RESOURCE_ID,
      },
      p_treaty_type: "tribute",
    });
  });

  it("passes p_duration_turns when a duration is provided", async () => {
    const row = createTreatyRow({ duration_turns: 10 });
    const { client, rpc } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = proposeTreatyMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      durationTurns: 10,
      proposedByCitizenId: CITIZEN_ID,
      proposerNationId: PROPOSER_NATION_ID,
      responderNationId: RESPONDER_NATION_ID,
      terms: {},
      treatyType: "trade_agreement",
    });

    expect(rpc).toHaveBeenCalledWith("propose_nation_treaty", {
      p_duration_turns: 10,
      p_proposed_by_citizen_id: CITIZEN_ID,
      p_proposer_nation_id: PROPOSER_NATION_ID,
      p_responder_nation_id: RESPONDER_NATION_ID,
      p_terms: {},
      p_treaty_type: "trade_agreement",
    });
  });

  it("calls propose_nation_treaty with snake_case royal_marriage terms", async () => {
    const row = createTreatyRow({
      terms: { citizen_a_id: CITIZEN_ID, citizen_b_id: CITIZEN_B_ID },
      treaty_type: "royal_marriage",
    });
    const { client, rpc } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = proposeTreatyMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      proposedByCitizenId: CITIZEN_ID,
      proposerNationId: PROPOSER_NATION_ID,
      responderNationId: RESPONDER_NATION_ID,
      terms: { citizenAId: CITIZEN_ID, citizenBId: CITIZEN_B_ID },
      treatyType: "royal_marriage",
    });

    expect(rpc).toHaveBeenCalledWith("propose_nation_treaty", {
      p_duration_turns: undefined,
      p_proposed_by_citizen_id: CITIZEN_ID,
      p_proposer_nation_id: PROPOSER_NATION_ID,
      p_responder_nation_id: RESPONDER_NATION_ID,
      p_terms: { citizen_a_id: CITIZEN_ID, citizen_b_id: CITIZEN_B_ID },
      p_treaty_type: "royal_marriage",
    });
  });

  it("rejects two identical citizens for royal_marriage before calling the RPC", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = proposeTreatyMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        proposedByCitizenId: CITIZEN_ID,
        proposerNationId: PROPOSER_NATION_ID,
        responderNationId: RESPONDER_NATION_ID,
        terms: { citizenAId: CITIZEN_ID, citizenBId: CITIZEN_ID },
        treatyType: "royal_marriage",
      }),
    ).rejects.toBeInstanceOf(NationTreatyMutationError);

    expect(rpc).not.toHaveBeenCalled();
  });

  it("raises treaty_not_found when the RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = proposeTreatyMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        proposedByCitizenId: CITIZEN_ID,
        proposerNationId: PROPOSER_NATION_ID,
        responderNationId: RESPONDER_NATION_ID,
        terms: {},
        treatyType: "trade_agreement",
      }),
    ).rejects.toMatchObject({ code: "treaty_not_found" });
  });

  it("propagates server errors via normalizeSupabaseError", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "P0001", message: "nations are at war" },
    });
    const queryClient = createQueryClient();
    const options = proposeTreatyMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        proposedByCitizenId: CITIZEN_ID,
        proposerNationId: PROPOSER_NATION_ID,
        responderNationId: RESPONDER_NATION_ID,
        terms: {},
        treatyType: "trade_agreement",
      }),
    ).rejects.toMatchObject({ message: "nations are at war" });
  });
});

describe("respondToTreatyMutationOptions", () => {
  it("calls respond_to_nation_treaty with the response", async () => {
    const row = createTreatyRow({ status: "active" });
    const { client, rpc } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = respondToTreatyMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      respondedByCitizenId: CITIZEN_ID,
      response: "accept",
      treatyId: TREATY_ID,
    });

    expect(rpc).toHaveBeenCalledWith("respond_to_nation_treaty", {
      p_responded_by_citizen_id: CITIZEN_ID,
      p_response: "accept",
      p_treaty_id: TREATY_ID,
    });
  });
});

describe("withdrawTreatyMutationOptions", () => {
  it("calls withdraw_nation_treaty with the treaty id", async () => {
    const row = createTreatyRow({ status: "withdrawn" });
    const { client, rpc } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = withdrawTreatyMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, { treatyId: TREATY_ID });

    expect(rpc).toHaveBeenCalledWith("withdraw_nation_treaty", {
      p_treaty_id: TREATY_ID,
    });
  });
});

describe("breakTreatyMutationOptions", () => {
  it("calls break_nation_treaty with the treaty id and acting citizen", async () => {
    const row = createTreatyRow({ status: "broken" });
    const { client, rpc } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = breakTreatyMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      brokenByCitizenId: CITIZEN_ID,
      treatyId: TREATY_ID,
    });

    expect(rpc).toHaveBeenCalledWith("break_nation_treaty", {
      p_broken_by_citizen_id: CITIZEN_ID,
      p_treaty_id: TREATY_ID,
    });
  });
});

describe("isNationTreatyMutationError", () => {
  it("identifies NationTreatyMutationError instances", () => {
    const error = new NationTreatyMutationError({
      code: "treaty_not_found",
      message: "Treaty could not be found.",
    });
    expect(isNationTreatyMutationError(error)).toBe(true);
    expect(isNationTreatyMutationError(new Error("other"))).toBe(false);
  });
});

function createTreatyRow(
  overrides: Partial<NationTreatyRow> = {},
): NationTreatyRow {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    duration_turns: null,
    ends_turn_number: null,
    id: TREATY_ID,
    proposed_by_citizen_id: CITIZEN_ID,
    proposer_nation_id: PROPOSER_NATION_ID,
    responded_by_citizen_id: null,
    responder_nation_id: RESPONDER_NATION_ID,
    starts_turn_number: null,
    status: "proposed",
    terms: {},
    treaty_type: "trade_agreement",
    updated_at: "2026-01-02T00:00:00.000Z",
    world_id: WORLD_ID,
    ...overrides,
  };
}

type SupabaseError = { readonly code?: string; readonly message: string };
type SupabaseResult<TData> =
  | { readonly data: TData; readonly error: null }
  | { readonly data: null; readonly error: SupabaseError | null };

function createRpcClient(result: SupabaseResult<NationTreatyRow>): {
  readonly client: GubernatorSupabaseClient;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  const single = vi.fn().mockResolvedValue(result);
  const rpc = vi.fn(() => ({ single }));
  const client = { rpc } as unknown as GubernatorSupabaseClient;
  return { client, rpc };
}

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

function executeMutation<TOptions extends { mutationFn?: unknown }>(
  queryClient: QueryClient,
  options: TOptions,
  variables: unknown,
): Promise<unknown> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options as never)
    .execute(variables);
}
