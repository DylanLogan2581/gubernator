import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import { AuthUiError } from "@/features/auth";
import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  isNationRelationshipMutationError,
  NationRelationshipMutationError,
  proposeBilateralMutationOptions,
  respondToBilateralMutationOptions,
  withdrawFromBilateralMutationOptions,
} from "./nationRelationshipMutations";

import type { NationRelationshipRow } from "../queries/nationRelationshipQueries";

const FROM_NATION_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TO_NATION_ID = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";
const RELATIONSHIP_ID = "cccccccc-cccc-cccc-cccc-cccccccccccc";

describe("proposeBilateralMutationOptions", () => {
  it("upserts with proposed status when no existing row", async () => {
    const row = createRelationshipRow({ pending_status: "proposed" });
    const { client, upsertFn } = createProposeBilateralClient({
      selectResult: { data: null, error: null },
      upsertResult: { data: row, error: null },
    });
    const queryClient = createQueryClient();
    const options = proposeBilateralMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      fromNationId: FROM_NATION_ID,
      stance: "allied",
      toNationId: TO_NATION_ID,
    });

    expect(upsertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        from_nation_id: FROM_NATION_ID,
        pending_stance: "allied",
        pending_status: "proposed",
        to_nation_id: TO_NATION_ID,
      }),
      expect.anything(),
    );
  });

  it("upserts when existing row has pending_status of proposed", async () => {
    const row = createRelationshipRow({ pending_status: "proposed" });
    const { client, upsertFn } = createProposeBilateralClient({
      selectResult: {
        data: { pending_status: "proposed" },
        error: null,
      },
      upsertResult: { data: row, error: null },
    });
    const queryClient = createQueryClient();
    const options = proposeBilateralMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      fromNationId: FROM_NATION_ID,
      stance: "allied",
      toNationId: TO_NATION_ID,
    });

    expect(upsertFn).toHaveBeenCalled();
  });

  it("throws relationship_already_accepted when pending_status is accepted", async () => {
    const { client, upsertFn } = createProposeBilateralClient({
      selectResult: {
        data: { pending_status: "accepted" },
        error: null,
      },
      upsertResult: { data: null, error: null },
    });
    const queryClient = createQueryClient();
    const options = proposeBilateralMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        fromNationId: FROM_NATION_ID,
        stance: "allied",
        toNationId: TO_NATION_ID,
      }),
    ).rejects.toMatchObject({ code: "relationship_already_accepted" });

    expect(upsertFn).not.toHaveBeenCalled();
  });

  it("raises NationRelationshipMutationError when accepted", async () => {
    const { client } = createProposeBilateralClient({
      selectResult: {
        data: { pending_status: "accepted" },
        error: null,
      },
      upsertResult: { data: null, error: null },
    });
    const queryClient = createQueryClient();
    const options = proposeBilateralMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        fromNationId: FROM_NATION_ID,
        stance: "allied",
        toNationId: TO_NATION_ID,
      }),
    ).rejects.toBeInstanceOf(NationRelationshipMutationError);
  });

  it("raises with code relationship_not_found when upsert returns no row", async () => {
    const { client } = createProposeBilateralClient({
      selectResult: { data: null, error: null },
      upsertResult: { data: null, error: null },
    });
    const queryClient = createQueryClient();
    const options = proposeBilateralMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        fromNationId: FROM_NATION_ID,
        stance: "allied",
        toNationId: TO_NATION_ID,
      }),
    ).rejects.toMatchObject({ code: "relationship_not_found" });
  });

  it("rejects invalid stance values before querying", async () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = proposeBilateralMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        fromNationId: FROM_NATION_ID,
        stance: "at_war",
        toNationId: TO_NATION_ID,
      }),
    ).rejects.toSatisfy(isNationRelationshipMutationError);
    expect(from).not.toHaveBeenCalled();
  });

  it("has the correct mutation key", () => {
    const from = vi.fn();
    const client = { from } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = proposeBilateralMutationOptions({ client, queryClient });

    expect(options.mutationKey).toContain("propose-bilateral");
  });
});

describe("respondToBilateralMutationOptions", () => {
  it("dispatches respond_to_bilateral RPC with accepted response", async () => {
    const row = createRelationshipRow({ current_stance: "allied" });
    const { client, rpc } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = respondToBilateralMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      fromNationId: FROM_NATION_ID,
      response: "accepted",
      toNationId: TO_NATION_ID,
    });

    expect(rpc).toHaveBeenCalledWith("respond_to_bilateral", {
      p_from_nation_id: FROM_NATION_ID,
      p_response: "accepted",
      p_to_nation_id: TO_NATION_ID,
    });
  });

  it("dispatches respond_to_bilateral RPC with declined response", async () => {
    const row = createRelationshipRow({ pending_status: "declined" });
    const { client, rpc } = createRpcClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = respondToBilateralMutationOptions({ client, queryClient });

    await executeMutation(queryClient, options, {
      fromNationId: FROM_NATION_ID,
      response: "declined",
      toNationId: TO_NATION_ID,
    });

    expect(rpc).toHaveBeenCalledWith("respond_to_bilateral", {
      p_from_nation_id: FROM_NATION_ID,
      p_response: "declined",
      p_to_nation_id: TO_NATION_ID,
    });
  });

  it("raises NationRelationshipMutationError when the RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = respondToBilateralMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        fromNationId: FROM_NATION_ID,
        response: "accepted",
        toNationId: TO_NATION_ID,
      }),
    ).rejects.toBeInstanceOf(NationRelationshipMutationError);
  });

  it("raises with code relationship_not_found when the RPC returns no row", async () => {
    const { client } = createRpcClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = respondToBilateralMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        fromNationId: FROM_NATION_ID,
        response: "accepted",
        toNationId: TO_NATION_ID,
      }),
    ).rejects.toMatchObject({ code: "relationship_not_found" });
  });

  it("normalizes Supabase errors from the RPC", async () => {
    const { client } = createRpcClient({
      data: null,
      error: { code: "42501", message: "permission denied" },
    });
    const queryClient = createQueryClient();
    const options = respondToBilateralMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        fromNationId: FROM_NATION_ID,
        response: "accepted",
        toNationId: TO_NATION_ID,
      }),
    ).rejects.toBeInstanceOf(AuthUiError);
  });

  it("rejects invalid response values before calling the RPC", async () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = respondToBilateralMutationOptions({ client, queryClient });

    await expect(
      executeMutation(queryClient, options, {
        fromNationId: FROM_NATION_ID,
        response: "invalid_response",
        toNationId: TO_NATION_ID,
      }),
    ).rejects.toSatisfy(isNationRelationshipMutationError);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("has the correct mutation key", () => {
    const rpc = vi.fn();
    const client = { rpc } as unknown as GubernatorSupabaseClient;
    const queryClient = createQueryClient();
    const options = respondToBilateralMutationOptions({ client, queryClient });

    expect(options.mutationKey).toContain("respond-to-bilateral");
  });
});

describe("withdrawFromBilateralMutationOptions", () => {
  it("updates the row to neutral with withdrawn status", async () => {
    const row = createRelationshipRow({
      current_stance: "neutral",
      pending_status: "withdrawn",
    });
    const { client, update } = createUpdateClient({ data: row, error: null });
    const queryClient = createQueryClient();
    const options = withdrawFromBilateralMutationOptions({
      client,
      queryClient,
    });

    await executeMutation(queryClient, options, {
      fromNationId: FROM_NATION_ID,
      toNationId: TO_NATION_ID,
    });

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        current_stance: "neutral",
        pending_status: "withdrawn",
      }),
    );
  });

  it("raises NationRelationshipMutationError when the update finds no row", async () => {
    const { client } = createUpdateClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = withdrawFromBilateralMutationOptions({
      client,
      queryClient,
    });

    await expect(
      executeMutation(queryClient, options, {
        fromNationId: FROM_NATION_ID,
        toNationId: TO_NATION_ID,
      }),
    ).rejects.toBeInstanceOf(NationRelationshipMutationError);
  });

  it("has the correct mutation key", () => {
    const { client } = createUpdateClient({ data: null, error: null });
    const queryClient = createQueryClient();
    const options = withdrawFromBilateralMutationOptions({
      client,
      queryClient,
    });

    expect(options.mutationKey).toContain("withdraw-from-bilateral");
  });
});

function createRelationshipRow(
  overrides: Partial<NationRelationshipRow> = {},
): NationRelationshipRow {
  return {
    created_at: "2026-01-01T00:00:00.000Z",
    current_stance: "neutral",
    from_nation_id: FROM_NATION_ID,
    id: RELATIONSHIP_ID,
    pending_changed_by_citizen_id: null,
    pending_stance: null,
    pending_status: null,
    to_nation_id: TO_NATION_ID,
    updated_at: "2026-01-02T00:00:00.000Z",
    ...overrides,
  };
}

type SupabaseError = { readonly code?: string; readonly message: string };
type SupabaseResult<TData> =
  | { readonly data: TData; readonly error: null }
  | { readonly data: null; readonly error: SupabaseError | null };

function createProposeBilateralClient({
  selectResult,
  upsertResult,
}: {
  readonly selectResult: {
    readonly data: { readonly pending_status: string | null } | null;
    readonly error: null;
  };
  readonly upsertResult: SupabaseResult<NationRelationshipRow>;
}): {
  readonly client: GubernatorSupabaseClient;
  readonly upsertFn: ReturnType<typeof vi.fn>;
} {
  const selectMaybeSingle = vi.fn().mockResolvedValue(selectResult);
  const selectEq = vi.fn(function (this: object) {
    return this;
  });
  const selectChain = { eq: selectEq, maybeSingle: selectMaybeSingle };
  const selectFn = vi.fn(() => selectChain);

  const upsertMaybeSingle = vi.fn().mockResolvedValue(upsertResult);
  const upsertSelect = vi.fn(() => ({ maybeSingle: upsertMaybeSingle }));
  const upsertFn = vi.fn(() => ({ select: upsertSelect }));

  const from = vi
    .fn()
    .mockReturnValueOnce({ select: selectFn })
    .mockReturnValue({ upsert: upsertFn });

  const client = { from } as unknown as GubernatorSupabaseClient;
  return { client, upsertFn };
}

function createRpcClient(result: SupabaseResult<NationRelationshipRow>): {
  readonly client: GubernatorSupabaseClient;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const rpc = vi.fn(() => ({ maybeSingle }));
  const client = { rpc } as unknown as GubernatorSupabaseClient;
  return { client, rpc };
}

function createUpdateClient(result: SupabaseResult<NationRelationshipRow>): {
  readonly client: GubernatorSupabaseClient;
  readonly update: ReturnType<typeof vi.fn>;
} {
  const chain = {
    eq: vi.fn(function (this: typeof chain) {
      return this;
    }),
    maybeSingle: vi.fn().mockResolvedValue(result),
    select: vi.fn(function (this: typeof chain) {
      return this;
    }),
  };
  const update = vi.fn(() => chain);
  const from = vi.fn(() => ({ update }));
  const client = { from } as unknown as GubernatorSupabaseClient;
  return { client, update };
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
