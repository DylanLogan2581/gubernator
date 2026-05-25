import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { AuthUiError } from "@/features/auth";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  createPartnershipMutationOptions,
  dissolvePartnershipMutationOptions,
  isPartnershipMutationError,
  markPartnershipWidowedMutationOptions,
  PartnershipMutationError,
  reassignPartnerMutationOptions,
} from "./partnershipsMutations";

import type { PartnershipRow } from "../queries/partnershipsQueries";

const CITIZEN_A_ID = "11111111-1111-1111-1111-111111111111";
const CITIZEN_B_ID = "22222222-2222-2222-2222-222222222222";
const CITIZEN_C_ID = "33333333-3333-3333-3333-333333333333";
const PARTNERSHIP_ID = "44444444-4444-4444-4444-444444444444";
const TURN_TRANSITION_ID = "55555555-5555-5555-5555-555555555555";

describe("createPartnershipMutationOptions", () => {
  it("rejects partnering a citizen with themselves", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = createPartnershipMutationOptions({ client, queryClient });

    const result = executeMutation(queryClient, options, {
      changeReason: "Self-marriage attempt.",
      citizenAId: CITIZEN_A_ID,
      citizenBId: CITIZEN_A_ID,
      formedOnTurnNumber: 1,
      status: "active",
      turnTransitionId: TURN_TRANSITION_ID,
    });

    await expect(result).rejects.toSatisfy(isPartnershipMutationError);
    await expect(result).rejects.toMatchObject({
      code: "partnership_input_invalid",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an active partnership that supplies an end turn", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = createPartnershipMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        changeReason: "Married in spring.",
        citizenAId: CITIZEN_A_ID,
        citizenBId: CITIZEN_B_ID,
        endedOnTurnNumber: 4,
        formedOnTurnNumber: 1,
        status: "active",
        turnTransitionId: TURN_TRANSITION_ID,
      }),
    ).rejects.toMatchObject({ code: "partnership_input_invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a widowed partnership without an end turn", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = createPartnershipMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        changeReason: "Widowed at birth.",
        citizenAId: CITIZEN_A_ID,
        citizenBId: CITIZEN_B_ID,
        formedOnTurnNumber: 1,
        status: "widowed",
        turnTransitionId: TURN_TRANSITION_ID,
      }),
    ).rejects.toMatchObject({ code: "partnership_input_invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("dispatches create_partnership with the resolved status default", async () => {
    const partnershipRow = createPartnershipRow();
    const { client, rpc } = createRpcClient({
      data: partnershipRow,
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = createPartnershipMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      changeReason: "Married in spring.",
      citizenAId: CITIZEN_A_ID,
      citizenBId: CITIZEN_B_ID,
      formedOnTurnNumber: 12,
      turnTransitionId: TURN_TRANSITION_ID,
    });

    expect(rpc).toHaveBeenCalledWith("create_partnership", {
      p_change_reason: "Married in spring.",
      p_citizen_a_id: CITIZEN_A_ID,
      p_citizen_b_id: CITIZEN_B_ID,
      p_ended_on_turn_number: undefined,
      p_formed_on_turn_number: 12,
      p_status: "active",
      p_turn_transition_id: TURN_TRANSITION_ID,
    });
    expect(options.mutationKey).toEqual(["citizens", "create-partnership"]);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["citizens", "partnerships-for-citizen", CITIZEN_A_ID],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["citizens", "partnerships-for-citizen", CITIZEN_B_ID],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["citizens", "active-partnership-for-citizen", CITIZEN_A_ID],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["citizens", "active-partnership-for-citizen", CITIZEN_B_ID],
    });
  });

  it("raises an unauthorized error when the RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = createPartnershipMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        changeReason: "Married in spring.",
        citizenAId: CITIZEN_A_ID,
        citizenBId: CITIZEN_B_ID,
        formedOnTurnNumber: 1,
        turnTransitionId: TURN_TRANSITION_ID,
      }),
    ).rejects.toBeInstanceOf(PartnershipMutationError);
  });

  it("normalizes Supabase errors raised by the RPC", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = createPartnershipMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        changeReason: "Married in spring.",
        citizenAId: CITIZEN_A_ID,
        citizenBId: CITIZEN_B_ID,
        formedOnTurnNumber: 1,
        turnTransitionId: TURN_TRANSITION_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

describe("dissolvePartnershipMutationOptions", () => {
  it("dispatches the dissolve_partnership RPC with the supplied end turn", async () => {
    const partnershipRow = createPartnershipRow({
      ended_on_turn_number: 7,
      status: "dissolved",
    });
    const { client, rpc } = createRpcClient({
      data: partnershipRow,
      error: null,
    });
    const queryClient = createQueryClient();
    const options = dissolvePartnershipMutationOptions({
      client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      changeReason: "Drifted apart.",
      endedOnTurnNumber: 7,
      partnershipId: PARTNERSHIP_ID,
      turnTransitionId: TURN_TRANSITION_ID,
    });

    expect(rpc).toHaveBeenCalledWith("dissolve_partnership", {
      p_change_reason: "Drifted apart.",
      p_ended_on_turn_number: 7,
      p_partnership_id: PARTNERSHIP_ID,
      p_turn_transition_id: TURN_TRANSITION_ID,
    });
    expect(options.mutationKey).toEqual(["citizens", "dissolve-partnership"]);
  });

  it("rejects negative end turns", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = dissolvePartnershipMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        changeReason: "Drifted apart.",
        endedOnTurnNumber: -1,
        partnershipId: PARTNERSHIP_ID,
        turnTransitionId: TURN_TRANSITION_ID,
      }),
    ).rejects.toMatchObject({ code: "partnership_input_invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("markPartnershipWidowedMutationOptions", () => {
  it("dispatches the mark_partnership_widowed RPC", async () => {
    const partnershipRow = createPartnershipRow({
      ended_on_turn_number: 8,
      status: "widowed",
    });
    const { client, rpc } = createRpcClient({
      data: partnershipRow,
      error: null,
    });
    const queryClient = createQueryClient();
    const options = markPartnershipWidowedMutationOptions({
      client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      changeReason: "Partner died.",
      endedOnTurnNumber: 8,
      partnershipId: PARTNERSHIP_ID,
      turnTransitionId: TURN_TRANSITION_ID,
    });

    expect(rpc).toHaveBeenCalledWith("mark_partnership_widowed", {
      p_change_reason: "Partner died.",
      p_ended_on_turn_number: 8,
      p_partnership_id: PARTNERSHIP_ID,
      p_turn_transition_id: TURN_TRANSITION_ID,
    });
  });

  it("requires a non-empty change reason", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = markPartnershipWidowedMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        changeReason: "   ",
        endedOnTurnNumber: 8,
        partnershipId: PARTNERSHIP_ID,
        turnTransitionId: TURN_TRANSITION_ID,
      }),
    ).rejects.toMatchObject({ code: "partnership_input_invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("reassignPartnerMutationOptions", () => {
  it("rejects reassigning to the retained citizen", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = reassignPartnerMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        changeReason: "Same partner.",
        endedOnTurnNumber: 8,
        formedOnTurnNumber: 9,
        newPartnerCitizenId: CITIZEN_A_ID,
        oldPartnershipId: PARTNERSHIP_ID,
        retainedCitizenId: CITIZEN_A_ID,
        turnTransitionId: TURN_TRANSITION_ID,
      }),
    ).rejects.toMatchObject({ code: "partnership_input_invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("dispatches reassign_partner with the supplied turn numbers", async () => {
    const partnershipRow = createPartnershipRow({
      citizen_a_id: CITIZEN_A_ID,
      citizen_b_id: CITIZEN_C_ID,
      formed_on_turn_number: 9,
    });
    const { client, rpc } = createRpcClient({
      data: partnershipRow,
      error: null,
    });
    const queryClient = createQueryClient();
    const options = reassignPartnerMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      changeReason: "Moved on.",
      endedOnTurnNumber: 8,
      formedOnTurnNumber: 9,
      newPartnerCitizenId: CITIZEN_C_ID,
      oldPartnershipId: PARTNERSHIP_ID,
      retainedCitizenId: CITIZEN_A_ID,
      turnTransitionId: TURN_TRANSITION_ID,
    });

    expect(rpc).toHaveBeenCalledWith("reassign_partner", {
      p_change_reason: "Moved on.",
      p_ended_on_turn_number: 8,
      p_formed_on_turn_number: 9,
      p_new_partner_citizen_id: CITIZEN_C_ID,
      p_old_partnership_id: PARTNERSHIP_ID,
      p_retained_citizen_id: CITIZEN_A_ID,
      p_turn_transition_id: TURN_TRANSITION_ID,
    });
  });
});

function createPartnershipRow(
  overrides: Partial<PartnershipRow> = {},
): PartnershipRow {
  return {
    change_reason: null,
    changed_by_user_id: null,
    citizen_a_id: CITIZEN_A_ID,
    citizen_b_id: CITIZEN_B_ID,
    created_at: "2026-05-01T00:00:00.000Z",
    ended_on_turn_number: null,
    formed_on_turn_number: 12,
    id: PARTNERSHIP_ID,
    status: "active",
    updated_at: "2026-05-01T00:00:00.000Z",
    ...overrides,
  };
}

type SupabaseError = { readonly code?: string; readonly message: string };
type SupabaseResult<TData> =
  | { readonly data: TData; readonly error: null }
  | { readonly data: null; readonly error: SupabaseError | null };

function createRpcClient(result: SupabaseResult<PartnershipRow>): {
  readonly client: GubernatorSupabaseClient;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const rpc = vi.fn(() => ({ maybeSingle }));
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
