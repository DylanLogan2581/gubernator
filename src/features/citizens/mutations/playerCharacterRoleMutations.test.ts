import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { AuthUiError } from "@/features/auth";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  assignCitizenRoleMutationOptions,
  isPlayerCharacterRoleMutationError,
  linkUserToCitizenMutationOptions,
  revokeCitizenRoleMutationOptions,
  unlinkUserFromCitizenMutationOptions,
} from "./playerCharacterRoleMutations";

import type { CitizenRow } from "../queries/citizensQueries";

const CITIZEN_ID = "11111111-1111-1111-1111-111111111111";
const WORLD_ID = "22222222-2222-2222-2222-222222222222";
const SETTLEMENT_ID = "33333333-3333-3333-3333-333333333333";
const USER_ID = "44444444-4444-4444-4444-444444444444";
const NATION_ID = "55555555-5555-5555-5555-555555555555";

describe("linkUserToCitizenMutationOptions", () => {
  it("dispatches link_user_to_citizen RPC with correct arguments on success", async () => {
    const citizenRow = createCitizenRow({ user_id: USER_ID });
    const { client, rpc } = createRpcClient({ data: citizenRow, error: null });
    const queryClient = createQueryClient();
    const options = linkUserToCitizenMutationOptions({ client, queryClient });

    const result = (await executeMutation(queryClient, options, {
      citizenId: CITIZEN_ID,
      userId: USER_ID,
      worldId: WORLD_ID,
    })) as { readonly id: string };

    expect(result.id).toBe(citizenRow.id);
    expect(rpc).toHaveBeenCalledWith("link_user_to_citizen", {
      p_citizen_id: CITIZEN_ID,
      p_user_id: USER_ID,
    });
    expect(options.mutationKey).toEqual(["citizens", "link-user-to-citizen"]);
  });

  it("returns citizen_role_input_invalid for schema violations before touching the client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = linkUserToCitizenMutationOptions({ client, queryClient });

    const result = executeMutation(queryClient, options, {
      citizenId: "not-a-uuid",
      userId: USER_ID,
      worldId: WORLD_ID,
    });

    await expect(result).rejects.toSatisfy(isPlayerCharacterRoleMutationError);
    await expect(result).rejects.toMatchObject({
      code: "citizen_role_input_invalid",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("surfaces citizen_role_unauthorized when the RPC returns null", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = linkUserToCitizenMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        citizenId: CITIZEN_ID,
        userId: USER_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "citizen_role_unauthorized" });
  });

  it("normalizes Supabase errors raised by the RPC", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = linkUserToCitizenMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        citizenId: CITIZEN_ID,
        userId: USER_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

describe("unlinkUserFromCitizenMutationOptions", () => {
  it("dispatches unlink_user_from_citizen RPC with correct arguments on success", async () => {
    const citizenRow = createCitizenRow();
    const { client, rpc } = createRpcClient({ data: citizenRow, error: null });
    const queryClient = createQueryClient();
    const options = unlinkUserFromCitizenMutationOptions({
      client,
      queryClient,
    });

    const result = (await executeMutation(queryClient, options, {
      citizenId: CITIZEN_ID,
      worldId: WORLD_ID,
    })) as { readonly id: string };

    expect(result.id).toBe(citizenRow.id);
    expect(rpc).toHaveBeenCalledWith("unlink_user_from_citizen", {
      p_citizen_id: CITIZEN_ID,
    });
    expect(options.mutationKey).toEqual([
      "citizens",
      "unlink-user-from-citizen",
    ]);
  });

  it("returns citizen_role_input_invalid for schema violations before touching the client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = unlinkUserFromCitizenMutationOptions({
      client,
      queryClient,
    });

    const result = executeMutation(queryClient, options, {
      citizenId: "not-a-uuid",
      worldId: WORLD_ID,
    });

    await expect(result).rejects.toSatisfy(isPlayerCharacterRoleMutationError);
    await expect(result).rejects.toMatchObject({
      code: "citizen_role_input_invalid",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("surfaces citizen_role_unauthorized when the RPC returns null", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = unlinkUserFromCitizenMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        citizenId: CITIZEN_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "citizen_role_unauthorized" });
  });

  it("normalizes Supabase errors raised by the RPC", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = unlinkUserFromCitizenMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        citizenId: CITIZEN_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

describe("assignCitizenRoleMutationOptions", () => {
  it("dispatches assign_citizen_role for nation_manager with roleNationId and null roleSettlementId", async () => {
    const citizenRow = createCitizenRow({
      role_type: "nation_manager",
      role_nation_id: NATION_ID,
    });
    const { client, rpc } = createRpcClient({ data: citizenRow, error: null });
    const queryClient = createQueryClient();
    const options = assignCitizenRoleMutationOptions({ client, queryClient });

    const result = (await executeMutation(queryClient, options, {
      citizenId: CITIZEN_ID,
      roleNationId: NATION_ID,
      roleSettlementId: null,
      roleType: "nation_manager",
      worldId: WORLD_ID,
    })) as { readonly id: string };

    expect(result.id).toBe(citizenRow.id);
    expect(rpc).toHaveBeenCalledWith("assign_citizen_role", {
      p_citizen_id: CITIZEN_ID,
      p_role_nation_id: NATION_ID,
      p_role_settlement_id: undefined,
      p_role_type: "nation_manager",
    });
    expect(options.mutationKey).toEqual(["citizens", "assign-citizen-role"]);
  });

  it("dispatches assign_citizen_role for settlement_manager with roleSettlementId and null roleNationId", async () => {
    const citizenRow = createCitizenRow({
      role_type: "settlement_manager",
      role_settlement_id: SETTLEMENT_ID,
    });
    const { client, rpc } = createRpcClient({ data: citizenRow, error: null });
    const queryClient = createQueryClient();
    const options = assignCitizenRoleMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      citizenId: CITIZEN_ID,
      roleNationId: null,
      roleSettlementId: SETTLEMENT_ID,
      roleType: "settlement_manager",
      worldId: WORLD_ID,
    });

    expect(rpc).toHaveBeenCalledWith("assign_citizen_role", {
      p_citizen_id: CITIZEN_ID,
      p_role_nation_id: undefined,
      p_role_settlement_id: SETTLEMENT_ID,
      p_role_type: "settlement_manager",
    });
  });

  it("rejects nation_manager when roleNationId is missing", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = assignCitizenRoleMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        citizenId: CITIZEN_ID,
        roleNationId: null,
        roleSettlementId: null,
        roleType: "nation_manager",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "citizen_role_input_invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects nation_manager when roleSettlementId is non-null", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = assignCitizenRoleMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        citizenId: CITIZEN_ID,
        roleNationId: NATION_ID,
        roleSettlementId: SETTLEMENT_ID,
        roleType: "nation_manager",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "citizen_role_input_invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects settlement_manager when roleSettlementId is missing", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = assignCitizenRoleMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        citizenId: CITIZEN_ID,
        roleNationId: null,
        roleSettlementId: null,
        roleType: "settlement_manager",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "citizen_role_input_invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects settlement_manager when roleNationId is non-null", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = assignCitizenRoleMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        citizenId: CITIZEN_ID,
        roleNationId: NATION_ID,
        roleSettlementId: SETTLEMENT_ID,
        roleType: "settlement_manager",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "citizen_role_input_invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects none roleType as not an assignable role", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = assignCitizenRoleMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        citizenId: CITIZEN_ID,
        roleNationId: null,
        roleSettlementId: null,
        roleType: "none",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "citizen_role_input_invalid" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("surfaces citizen_role_unauthorized when the RPC returns null", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = assignCitizenRoleMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        citizenId: CITIZEN_ID,
        roleNationId: NATION_ID,
        roleSettlementId: null,
        roleType: "nation_manager",
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "citizen_role_unauthorized" });
  });

  it("normalizes Supabase errors raised by the RPC", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = assignCitizenRoleMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        citizenId: CITIZEN_ID,
        roleNationId: NATION_ID,
        roleSettlementId: null,
        roleType: "nation_manager",
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });
});

describe("revokeCitizenRoleMutationOptions", () => {
  it("dispatches revoke_citizen_role RPC with correct arguments on success", async () => {
    const citizenRow = createCitizenRow();
    const { client, rpc } = createRpcClient({ data: citizenRow, error: null });
    const queryClient = createQueryClient();
    const options = revokeCitizenRoleMutationOptions({ client, queryClient });

    const result = (await executeMutation(queryClient, options, {
      citizenId: CITIZEN_ID,
      worldId: WORLD_ID,
    })) as { readonly id: string };

    expect(result.id).toBe(citizenRow.id);
    expect(rpc).toHaveBeenCalledWith("revoke_citizen_role", {
      p_citizen_id: CITIZEN_ID,
    });
    expect(options.mutationKey).toEqual(["citizens", "revoke-citizen-role"]);
  });

  it("returns citizen_role_input_invalid for schema violations before touching the client", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = revokeCitizenRoleMutationOptions({ client, queryClient });

    const result = executeMutation(queryClient, options, {
      citizenId: "not-a-uuid",
      worldId: WORLD_ID,
    });

    await expect(result).rejects.toSatisfy(isPlayerCharacterRoleMutationError);
    await expect(result).rejects.toMatchObject({
      code: "citizen_role_input_invalid",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("surfaces citizen_role_unauthorized when the RPC returns null", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = revokeCitizenRoleMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        citizenId: CITIZEN_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toMatchObject({ code: "citizen_role_unauthorized" });
  });

  it("normalizes Supabase errors raised by the RPC", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = revokeCitizenRoleMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        citizenId: CITIZEN_ID,
        worldId: WORLD_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
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
    npc_flaw: null,
    npc_goal: null,
    npc_secret_contradiction: null,
    npc_trait_1: null,
    npc_trait_2: null,
    parent_a_citizen_id: null,
    parent_b_citizen_id: null,
    personality_text: null,
    profile_photo_url: null,
    role_nation_id: null,
    role_settlement_id: null,
    role_type: "none",
    settlement_id: SETTLEMENT_ID,
    sex: null,
    skills_text: null,
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
