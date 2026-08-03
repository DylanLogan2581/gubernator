import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import { parseMutationInput } from "@/lib/parseMutationInput";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import type { Json } from "@/types/database";

import { lawDocumentsQueryKeys } from "../queries/lawDocumentsQueryKeys";
import {
  createLawDocumentInputSchema,
  repealLawDocumentInputSchema,
  type CreateLawDocumentInput,
  type RepealLawDocumentInput,
} from "../schemas/lawDocumentSchemas";

import type { z } from "zod";

type LawDocumentMutationErrorCode = "law_document_input_invalid";

export type LawDocumentMutationIssue = MutationIssue;

export const {
  ErrorClass: LawDocumentMutationError,
  isError: isLawDocumentMutationError,
} = createMutationError<LawDocumentMutationErrorCode>(
  "LawDocumentMutationError",
);
export type LawDocumentMutationError = InstanceType<
  typeof LawDocumentMutationError
>;

export type CreateLawDocumentMutationOptions = UseMutationOptions<
  void,
  AuthUiError | LawDocumentMutationError,
  CreateLawDocumentInput
>;

export type RepealLawDocumentMutationOptions = UseMutationOptions<
  void,
  AuthUiError | LawDocumentMutationError,
  RepealLawDocumentInput & {
    readonly nationId: string | null;
    readonly settlementId: string | null;
  }
>;

function invalidateLawDocumentQueries(
  queryClient: QueryClient,
  {
    nationId,
    settlementId,
  }: { nationId: string | null; settlementId: string | null },
): Promise<void> {
  return Promise.all([
    nationId === null
      ? Promise.resolve()
      : queryClient.invalidateQueries({
          queryKey: lawDocumentsQueryKeys.nationList(nationId),
        }),
    settlementId === null
      ? Promise.resolve()
      : queryClient.invalidateQueries({
          queryKey: lawDocumentsQueryKeys.settlementList(settlementId),
        }),
  ]).then(() => undefined);
}

export function createLawDocumentMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CreateLawDocumentMutationOptions {
  return mutationOptions({
    mutationFn: (input: CreateLawDocumentInput) =>
      createLawDocument(client, input),
    mutationKey: [...lawDocumentsQueryKeys.all, "create-law-document"],
    onSuccess: (_result, input) =>
      invalidateLawDocumentQueries(queryClient, {
        nationId: input.nationId,
        settlementId: input.settlementId,
      }),
  });
}

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new LawDocumentMutationError({
        code: "law_document_input_invalid",
        issues,
        message: "Document input is invalid.",
      }),
  );
}

async function createLawDocument(
  client: GubernatorSupabaseClient,
  input: CreateLawDocumentInput,
): Promise<void> {
  const values = parseInput(createLawDocumentInputSchema, input);

  const { error } = await client.rpc("create_law_document", {
    p_amendment_procedure_json: values.amendmentProcedure as Json,
    p_articles: values.articles.map((article) => ({
      bodyMarkdown: article.bodyMarkdown,
      heading: article.heading,
    })) as Json,
    p_nation_id: values.nationId as string,
    // Generated types don't reflect nullable parameters; null is valid.
    p_preamble_markdown: values.preambleMarkdown as string,
    p_settlement_id: values.settlementId as string,
    p_title: values.title,
    p_world_id: values.worldId,
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }
}

export function repealLawDocumentMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): RepealLawDocumentMutationOptions {
  return mutationOptions({
    mutationFn: (
      input: RepealLawDocumentInput & {
        readonly nationId: string | null;
        readonly settlementId: string | null;
      },
    ) => repealLawDocument(client, input),
    mutationKey: [...lawDocumentsQueryKeys.all, "repeal-law-document"],
    onSuccess: (_result, input) =>
      invalidateLawDocumentQueries(queryClient, {
        nationId: input.nationId,
        settlementId: input.settlementId,
      }),
  });
}

async function repealLawDocument(
  client: GubernatorSupabaseClient,
  input: RepealLawDocumentInput,
): Promise<void> {
  const values = parseInput(repealLawDocumentInputSchema, input);

  const { error } = await client.rpc("repeal_law_document", {
    p_document_id: values.id,
  });

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }
}
