import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { AuthUiError } from "@/features/auth";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  CitizenMutationError,
  createNpcMutationOptions,
  createPlayerCharacterMutationOptions,
  isCitizenMutationError,
  markCitizenDeadMutationOptions,
  reviveCitizenMutationOptions,
  updateCitizenCoreMutationOptions,
  updateCitizenNpcFieldsMutationOptions,
} from "./citizensMutations";

import type { CitizenRow } from "../queries/citizensQueries";

const CITIZEN_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";
const SETTLEMENT_ID = "33333333-3333-3333-3333-333333333333";
const USER_ID = "44444444-4444-4444-4444-444444444444";
const PARENT_A_ID = "55555555-5555-5555-5555-555555555555";
const PARENT_B_ID = "66666666-6666-6666-6666-666666666666";

describe("createNpcMutationOptions", () => {
  it("rejects invalid input before touching the Supabase client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = createNpcMutationOptions({ client, queryClient });

    const result = executeMutation(queryClient, options, {
      bornOnTurnNumber: null,
      givenName: "   ",
      surname: null,
      npcFlaw: null,
      npcGoal: null,
      npcSecretContradiction: null,
      npcTrait1: null,
      npcTrait2: null,
      parentACitizenId: null,
      parentBCitizenId: null,
      personalityText: null,
      profilePhotoUrl: null,
      settlementId: SETTLEMENT_ID,
      sex: null,
      skillsText: null,
      worldId: WORLD_ID,
    });

    await expect(result).rejects.toSatisfy(isCitizenMutationError);
    await expect(result).rejects.toMatchObject({
      code: "citizen_input_invalid",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("dispatches the create_npc RPC with trimmed inputs on success", async () => {
    const citizenRow = createCitizenRow();
    const { client, rpc } = createRpcClient({ data: citizenRow, error: null });
    const queryClient = createQueryClient();
    const options = createNpcMutationOptions({ client, queryClient });

    const result = (await executeMutation(queryClient, options, {
      bornOnTurnNumber: 5,
      givenName: "  Aldra  ",
      surname: null,
      npcFlaw: "  pride  ",
      npcGoal: "council seat",
      npcSecretContradiction: null,
      npcTrait1: "earnest",
      npcTrait2: "wry",
      parentACitizenId: null,
      parentBCitizenId: null,
      personalityText: null,
      profilePhotoUrl: null,
      settlementId: SETTLEMENT_ID,
      sex: "f",
      skillsText: null,
      worldId: WORLD_ID,
    })) as { readonly id: string };

    expect(result.id).toBe(citizenRow.id);
    expect(rpc).toHaveBeenCalledWith(
      "create_npc",
      expect.objectContaining({
        p_born_on_turn_number: 5,
        p_given_name: "Aldra",
        p_npc_flaw: "pride",
        p_npc_goal: "council seat",
        p_npc_trait_1: "earnest",
        p_npc_trait_2: "wry",
        p_settlement_id: SETTLEMENT_ID,
        p_sex: "f",
        p_world_id: WORLD_ID,
      }),
    );
    expect(options.mutationKey).toEqual(["citizens", "create-npc"]);
  });

  it("raises a creation-blocked error when the RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = createNpcMutationOptions({ client, queryClient });

    const result = executeMutation(queryClient, options, {
      bornOnTurnNumber: null,
      givenName: "Aldra",
      surname: null,
      npcFlaw: null,
      npcGoal: null,
      npcSecretContradiction: null,
      npcTrait1: null,
      npcTrait2: null,
      parentACitizenId: null,
      parentBCitizenId: null,
      personalityText: null,
      profilePhotoUrl: null,
      settlementId: null,
      sex: null,
      skillsText: null,
      worldId: WORLD_ID,
    });

    await expect(result).rejects.toBeInstanceOf(CitizenMutationError);
    await expect(result).rejects.toMatchObject({
      code: "citizen_creation_blocked",
    });
  });

  it("normalizes Supabase errors raised by the RPC", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = createNpcMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        bornOnTurnNumber: null,
        givenName: "Aldra",
        surname: null,
        npcFlaw: null,
        npcGoal: null,
        npcSecretContradiction: null,
        npcTrait1: null,
        npcTrait2: null,
        parentACitizenId: null,
        parentBCitizenId: null,
        personalityText: null,
        profilePhotoUrl: null,
        settlementId: null,
        sex: null,
        skillsText: null,
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

describe("createPlayerCharacterMutationOptions", () => {
  it("requires a user id and rejects NPC-shaped input", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = createPlayerCharacterMutationOptions({
      client,
      queryClient,
    });

    const result = executeMutation(queryClient, options, {
      bornOnTurnNumber: null,
      givenName: "Brann",
      surname: null,
      npcFlaw: null,
      npcGoal: null,
      npcSecretContradiction: null,
      npcTrait1: null,
      npcTrait2: null,
      parentACitizenId: null,
      parentBCitizenId: null,
      personalityText: null,
      profilePhotoUrl: null,
      settlementId: SETTLEMENT_ID,
      sex: null,
      skillsText: null,
      userId: undefined,
      worldId: WORLD_ID,
    });

    await expect(result).rejects.toMatchObject({
      code: "citizen_input_invalid",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("dispatches create_player_character with the linked user", async () => {
    const citizenRow = createCitizenRow({ citizen_type: "player_character" });
    const { client, rpc } = createRpcClient({ data: citizenRow, error: null });
    const queryClient = createQueryClient();
    const options = createPlayerCharacterMutationOptions({
      client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      bornOnTurnNumber: null,
      givenName: "Brann",
      surname: null,
      npcFlaw: null,
      npcGoal: null,
      npcSecretContradiction: null,
      npcTrait1: null,
      npcTrait2: null,
      parentACitizenId: PARENT_A_ID,
      parentBCitizenId: PARENT_B_ID,
      personalityText: null,
      profilePhotoUrl: null,
      settlementId: SETTLEMENT_ID,
      sex: null,
      skillsText: null,
      userId: USER_ID,
      worldId: WORLD_ID,
    });

    expect(rpc).toHaveBeenCalledWith(
      "create_player_character",
      expect.objectContaining({
        p_given_name: "Brann",
        p_parent_a_citizen_id: PARENT_A_ID,
        p_parent_b_citizen_id: PARENT_B_ID,
        p_settlement_id: SETTLEMENT_ID,
        p_user_id: USER_ID,
        p_world_id: WORLD_ID,
      }),
    );
    expect(options.mutationKey).toEqual([
      "citizens",
      "create-player-character",
    ]);
  });
});

describe("updateCitizenCoreMutationOptions", () => {
  it("rejects a blank citizen name before touching the Supabase client", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = updateCitizenCoreMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        citizenId: CITIZEN_ID,
        givenName: "   ",
        surname: null,
        sex: null,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "citizen_input_invalid" });
    expect(from).not.toHaveBeenCalled();
  });

  it("updates only name and sex, scoped by id and world, and invalidates caches", async () => {
    const citizenRow = createCitizenRow();
    const { client, calls } = createUpdateClient({
      data: citizenRow,
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = updateCitizenCoreMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      citizenId: CITIZEN_ID,
      givenName: " Aldra ",
      surname: null,
      sex: " f ",
      worldId: WORLD_ID,
    });

    expect(calls.from).toHaveBeenCalledWith("citizens");
    expect(calls.update).toHaveBeenCalledWith({
      given_name: "Aldra",
      surname: null,
      sex: "f",
    });
    expect(calls.eqId).toHaveBeenCalledWith("id", CITIZEN_ID);
    expect(calls.eqWorld).toHaveBeenCalledWith("world_id", WORLD_ID);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["citizens", "detail", citizenRow.id],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["citizens", "settlement-list", SETTLEMENT_ID],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["citizens", "settlement-aggregate-stats", SETTLEMENT_ID],
    });
  });

  it("raises a not-found error when the update returns no row", async () => {
    const { client } = createUpdateClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = updateCitizenCoreMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        citizenId: CITIZEN_ID,
        givenName: "Aldra",
        surname: null,
        sex: null,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "citizen_not_found" });
  });
});

describe("updateCitizenNpcFieldsMutationOptions", () => {
  it("writes only the NPC-text columns and invalidates the citizen detail", async () => {
    const citizenRow = createCitizenRow();
    const { client, calls } = createUpdateClient({
      data: citizenRow,
      error: null,
    });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = updateCitizenNpcFieldsMutationOptions({
      client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      citizenId: CITIZEN_ID,
      npcFlaw: " pride ",
      npcGoal: "to lead",
      npcSecretContradiction: null,
      npcTrait1: "earnest",
      npcTrait2: "wry",
      personalityText: "Quiet.",
      skillsText: "Reads runes.",
      worldId: WORLD_ID,
    });

    expect(calls.update).toHaveBeenCalledWith({
      npc_flaw: "pride",
      npc_goal: "to lead",
      npc_secret_contradiction: null,
      npc_trait_1: "earnest",
      npc_trait_2: "wry",
      personality_text: "Quiet.",
      skills_text: "Reads runes.",
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["citizens", "detail", citizenRow.id],
    });
    expect(invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: ["citizens", "settlement-list", expect.any(String)],
    });
  });
});

describe("markCitizenDeadMutationOptions and reviveCitizenMutationOptions", () => {
  it("marks the citizen dead with the trimmed death cause", async () => {
    const citizenRow = createCitizenRow({
      death_cause: "fever",
      status: "dead",
    });
    const { client, calls } = createUpdateClient({
      data: citizenRow,
      error: null,
    });
    const queryClient = createQueryClient();
    const options = markCitizenDeadMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      citizenId: CITIZEN_ID,
      deathCause: " fever ",
      worldId: WORLD_ID,
    });

    expect(calls.update).toHaveBeenCalledWith({
      death_cause: "fever",
      status: "dead",
    });
  });

  it("revives by clearing death_cause and resetting status", async () => {
    const citizenRow = createCitizenRow({ status: "alive" });
    const { client, calls } = createUpdateClient({
      data: citizenRow,
      error: null,
    });
    const queryClient = createQueryClient();
    const options = reviveCitizenMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      citizenId: CITIZEN_ID,
      worldId: WORLD_ID,
    });

    expect(calls.update).toHaveBeenCalledWith({
      death_cause: null,
      status: "alive",
    });
  });
});

function createCitizenRow(overrides: Partial<CitizenRow> = {}): CitizenRow {
  return {
    born_on_turn_number: null,
    citizen_type: "npc",
    created_at: "2026-05-01T00:00:00.000Z",
    death_cause: null,
    death_cause_category: null,
    given_name: "Aldra",
    id: CITIZEN_ID,
    name: "Aldra",
    parent_a_citizen_id: null,
    parent_b_citizen_id: null,
    profile_photo_url: null,
    role_nation_id: null,
    role_settlement_id: null,
    role_type: "none",
    settlement_id: SETTLEMENT_ID,
    sex: null,
    status: "alive",
    surname: null,
    updated_at: "2026-05-01T00:00:00.000Z",
    user_id: null,
    world_id: WORLD_ID,
    ...overrides,
  };
}

type SupabaseError = { readonly code?: string; readonly message: string };
type SupabaseResult<TData> =
  | { readonly data: TData; readonly error: null }
  | { readonly data: null; readonly error: SupabaseError | null };

function createRpcClient(result: SupabaseResult<CitizenRow>): {
  readonly client: GubernatorSupabaseClient;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const rpc = vi.fn(() => ({ maybeSingle }));
  const client = { rpc } as unknown as GubernatorSupabaseClient;
  return { client, rpc };
}

function createUpdateClient(result: SupabaseResult<CitizenRow>): {
  readonly client: GubernatorSupabaseClient;
  readonly calls: {
    readonly from: ReturnType<typeof vi.fn>;
    readonly update: ReturnType<typeof vi.fn>;
    readonly eqId: ReturnType<typeof vi.fn>;
    readonly eqWorld: ReturnType<typeof vi.fn>;
    readonly select: ReturnType<typeof vi.fn>;
  };
} {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const select = vi.fn(() => ({ maybeSingle }));
  const eqWorld = vi.fn(() => ({ select }));
  const eqId = vi.fn(() => ({ eq: eqWorld }));
  const update = vi.fn(() => ({ eq: eqId }));
  const from = vi.fn(() => ({ update }));
  return {
    client: { from } as unknown as GubernatorSupabaseClient,
    calls: { from, update, eqId, eqWorld, select },
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
