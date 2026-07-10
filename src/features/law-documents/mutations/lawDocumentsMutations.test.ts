import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GubernatorSupabaseClient } from "@/lib/supabase";

import {
  createLawDocumentMutationOptions,
  isLawDocumentMutationError,
  type CreateLawDocumentMutationOptions,
} from "./lawDocumentsMutations";

import type {
  AmendmentProcedureInput,
  CreateLawDocumentInput,
} from "../schemas/lawDocumentSchemas";

const WORLD_ID = "11111111-1111-1111-1111-111111111111";
const NATION_ID = "22222222-2222-2222-2222-222222222222";
const BODY_ID = "33333333-3333-3333-3333-333333333333";
const SECOND_BODY_ID = "44444444-4444-4444-4444-444444444444";
const OFFICE_TYPE_ID = "55555555-5555-5555-5555-555555555555";

const BASE_INPUT = {
  articles: [{ bodyMarkdown: "Body.", heading: "Article I" }],
  nationId: NATION_ID,
  preambleMarkdown: null,
  settlementId: null,
  title: "The Founding Charter",
  worldId: WORLD_ID,
} satisfies Omit<CreateLawDocumentInput, "amendmentProcedure">;

describe("createLawDocumentMutationOptions", () => {
  const cases: readonly {
    readonly amendmentProcedure: AmendmentProcedureInput;
    readonly name: string;
  }[] = [
    {
      amendmentProcedure: { kind: "decree", authority: "ruler" },
      name: "decree",
    },
    {
      amendmentProcedure: {
        kind: "decree",
        authority: { officeTypeId: OFFICE_TYPE_ID },
      },
      name: "decree (office)",
    },
    {
      amendmentProcedure: {
        kind: "vote",
        bodyId: BODY_ID,
        threshold: "majority",
        votingPeriodTurns: 10,
        secondBodyId: SECOND_BODY_ID,
      },
      name: "vote",
    },
    {
      amendmentProcedure: { kind: "locked" },
      name: "locked",
    },
  ];

  it.each(cases)(
    "sends the $name amendment procedure verbatim, never a silent {} fallback",
    async ({ amendmentProcedure }) => {
      const clientFixture = createClient({ error: null });
      const queryClient = createQueryClient();
      const options = createLawDocumentMutationOptions({
        client: clientFixture.client,
        queryClient,
      });

      await executeCreateMutation(queryClient, options, {
        ...BASE_INPUT,
        amendmentProcedure,
      });

      expect(clientFixture.rpc).toHaveBeenCalledWith("create_law_document", {
        p_amendment_procedure_json: amendmentProcedure,
        p_articles: [{ bodyMarkdown: "Body.", heading: "Article I" }],
        p_nation_id: NATION_ID,
        p_preamble_markdown: null,
        p_settlement_id: null,
        p_title: "The Founding Charter",
        p_world_id: WORLD_ID,
      });
    },
  );

  it("rejects a missing amendment procedure before calling the RPC", async () => {
    const clientFixture = createClient({ error: null });
    const queryClient = createQueryClient();
    const options = createLawDocumentMutationOptions({
      client: clientFixture.client,
      queryClient,
    });

    await expect(
      executeCreateMutation(queryClient, options, {
        ...BASE_INPUT,
        amendmentProcedure: undefined as never,
      }),
    ).rejects.toSatisfy(isLawDocumentMutationError);
    expect(clientFixture.rpc).not.toHaveBeenCalled();
  });

  it("rejects an unknown amendment procedure kind before calling the RPC", async () => {
    const clientFixture = createClient({ error: null });
    const queryClient = createQueryClient();
    const options = createLawDocumentMutationOptions({
      client: clientFixture.client,
      queryClient,
    });

    await expect(
      executeCreateMutation(queryClient, options, {
        ...BASE_INPUT,
        amendmentProcedure: { kind: "referendum" } as never,
      }),
    ).rejects.toSatisfy(isLawDocumentMutationError);
    expect(clientFixture.rpc).not.toHaveBeenCalled();
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

function executeCreateMutation(
  queryClient: QueryClient,
  options: CreateLawDocumentMutationOptions,
  variables: CreateLawDocumentInput,
): Promise<unknown> {
  return queryClient
    .getMutationCache()
    .build(queryClient, options)
    .execute(variables);
}

function createClient({
  error,
}: {
  readonly error: { readonly code?: string; readonly message: string } | null;
}): {
  readonly client: GubernatorSupabaseClient;
  readonly rpc: ReturnType<typeof vi.fn>;
} {
  const rpc = vi.fn().mockResolvedValue({ data: null, error });
  const client = { rpc } as unknown as GubernatorSupabaseClient;

  return { client, rpc };
}
