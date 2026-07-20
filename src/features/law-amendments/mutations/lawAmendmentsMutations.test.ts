import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  castLawAmendmentVoteMutationOptions,
  proposeLawAmendmentMutationOptions,
  type CastLawAmendmentVoteMutationOptions,
  type ProposeLawAmendmentMutationOptions,
} from "./lawAmendmentsMutations";

import type {
  CastLawAmendmentVoteInput,
  ProposeLawAmendmentInput,
} from "../schemas/lawAmendmentSchemas";

const DOCUMENT_ID = "11111111-1111-1111-1111-111111111111";
const AMENDMENT_ID = "22222222-2222-2222-2222-222222222222";
const CITIZEN_ID = "33333333-3333-3333-3333-333333333333";
const OTHER_CITIZEN_ID = "44444444-4444-4444-4444-444444444444";

describe("proposeLawAmendmentMutationOptions", () => {
  it("proposes an amendment and invalidates amendment + document queries", async () => {
    const clientFixture = createClient({
      rpcResult: {
        data: {
          created_at: "2026-05-02T12:00:00.000Z",
          deadline_turn_number: 10,
          document_id: DOCUMENT_ID,
          id: AMENDMENT_ID,
          operations_json: [{ op: "add_article" }],
          proposed_by_citizen_id: CITIZEN_ID,
          proposed_turn_number: 4,
          rationale_markdown: "Because reasons.",
          resolved_turn_number: null,
          status: "proposed",
          title: "Amend the charter",
          updated_at: "2026-05-02T12:00:00.000Z",
        },
        error: null,
      },
    });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = proposeLawAmendmentMutationOptions({
      client: clientFixture.client,
      queryClient,
    });

    const result = await executeProposeMutation(queryClient, options, {
      documentId: DOCUMENT_ID,
      operations: [{ op: "add_article" }],
      proposingCitizenId: CITIZEN_ID,
      rationaleMarkdown: "Because reasons.",
      title: "Amend the charter",
    });

    expect(result).toEqual({
      createdAt: "2026-05-02T12:00:00.000Z",
      deadlineTurnNumber: 10,
      documentId: DOCUMENT_ID,
      id: AMENDMENT_ID,
      operations: [{ op: "add_article" }],
      proposedByCitizenId: CITIZEN_ID,
      proposedTurnNumber: 4,
      rationaleMarkdown: "Because reasons.",
      resolvedTurnNumber: null,
      status: "proposed",
      title: "Amend the charter",
      updatedAt: "2026-05-02T12:00:00.000Z",
    });
    expect(clientFixture.rpc).toHaveBeenCalledWith("propose_law_amendment", {
      p_document_id: DOCUMENT_ID,
      p_operations_json: [{ op: "add_article" }],
      p_proposing_citizen_id: CITIZEN_ID,
      p_rationale_markdown: "Because reasons.",
      p_title: "Amend the charter",
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["nations", "law-amendments", "document", DOCUMENT_ID],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["nations", "law-amendments", "votes", AMENDMENT_ID],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["nations", "law-documents", "articles", DOCUMENT_ID],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["nations", "law-documents", "versions", DOCUMENT_ID],
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["nations", "law-amendments", "awaiting-my-vote"],
    });
  });

  it("throws a normalized error when the proposal is rejected", async () => {
    const clientFixture = createClient({
      rpcResult: {
        data: null,
        error: { code: "42501", message: "not eligible to propose" },
      },
    });
    const queryClient = createQueryClient();
    const options = proposeLawAmendmentMutationOptions({
      client: clientFixture.client,
      queryClient,
    });

    await expect(
      executeProposeMutation(queryClient, options, {
        documentId: DOCUMENT_ID,
        operations: [{ op: "add_article" }],
        proposingCitizenId: CITIZEN_ID,
        rationaleMarkdown: null,
        title: "Amend the charter",
      }),
    ).rejects.toThrow("not eligible to propose");
  });
});

describe("castLawAmendmentVoteMutationOptions", () => {
  it("casts a vote and invalidates amendment, votes, and document queries", async () => {
    const clientFixture = createClient({
      rpcResult: {
        data: {
          amendment_id: AMENDMENT_ID,
          cast_by_user_id: "user-1",
          created_at: "2026-05-02T12:00:00.000Z",
          id: "vote-1",
          vote: true,
          voter_citizen_id: CITIZEN_ID,
        },
        error: null,
      },
    });
    const queryClient = createQueryClient();
    const invalidateQueries = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockResolvedValue();
    const options = castLawAmendmentVoteMutationOptions({
      client: clientFixture.client,
      queryClient,
    });

    const result = await executeCastVoteMutation(queryClient, options, {
      amendmentId: AMENDMENT_ID,
      documentId: DOCUMENT_ID,
      vote: true,
      voterCitizenId: CITIZEN_ID,
    });

    expect(result).toEqual({
      amendmentId: AMENDMENT_ID,
      castByUserId: "user-1",
      createdAt: "2026-05-02T12:00:00.000Z",
      id: "vote-1",
      vote: true,
      voterCitizenId: CITIZEN_ID,
    });
    expect(clientFixture.rpc).toHaveBeenCalledWith("cast_law_amendment_vote", {
      p_amendment_id: AMENDMENT_ID,
      p_vote: true,
      p_voter_citizen_id: CITIZEN_ID,
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: ["nations", "law-amendments", "votes", AMENDMENT_ID],
    });
  });

  it("throws a normalized error when the vote is rejected", async () => {
    const clientFixture = createClient({
      rpcResult: {
        data: null,
        error: { code: "42501", message: "not a resolved body member" },
      },
    });
    const queryClient = createQueryClient();
    const options = castLawAmendmentVoteMutationOptions({
      client: clientFixture.client,
      queryClient,
    });

    await expect(
      executeCastVoteMutation(queryClient, options, {
        amendmentId: AMENDMENT_ID,
        documentId: DOCUMENT_ID,
        vote: true,
        voterCitizenId: OTHER_CITIZEN_ID,
      }),
    ).rejects.toThrow("not a resolved body member");
  });
});

function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      mutations: { retry: false },
      queries: { retry: false },
    },
  });
}

function executeProposeMutation(
  queryClient: QueryClient,
  options: ProposeLawAmendmentMutationOptions,
  variables: ProposeLawAmendmentInput,
): Promise<unknown> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options)
    .execute(variables);
}

function executeCastVoteMutation(
  queryClient: QueryClient,
  options: CastLawAmendmentVoteMutationOptions,
  variables: CastLawAmendmentVoteInput & { readonly documentId: string },
): Promise<unknown> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options)
    .execute(variables);
}

function createClient({
  rpcResult,
}: {
  readonly rpcResult: {
    readonly data: unknown;
    readonly error: { readonly code?: string; readonly message: string } | null;
  };
}): {
  readonly client: GubernatorSupabaseClient;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  const single = vi.fn().mockResolvedValue(rpcResult);
  const rpc = vi.fn(() => ({ single }));
  const client = { rpc } as unknown as GubernatorSupabaseClient;

  return { client, rpc };
}
