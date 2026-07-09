import {
  mutationOptions,
  type QueryClient,
  type UseMutationOptions,
} from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import { lawDocumentsQueryKeys } from "@/features/law-documents";
import { createMutationError, type MutationIssue } from "@/lib/mutationError";
import { parseMutationInput } from "@/lib/parseMutationInput";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import type { Database, Json } from "@/types/database";

import { lawAmendmentsQueryKeys } from "../queries/lawAmendmentsQueryKeys";
import {
  castLawAmendmentVoteInputSchema,
  proposeLawAmendmentInputSchema,
  withdrawLawAmendmentInputSchema,
  type CastLawAmendmentVoteInput,
  type ProposeLawAmendmentInput,
  type WithdrawLawAmendmentInput,
} from "../schemas/lawAmendmentSchemas";

import type {
  LawAmendment,
  LawAmendmentVote,
} from "../types/lawAmendmentTypes";
import type { z } from "zod";

type LawAmendmentMutationErrorCode = "law_amendment_input_invalid";

export type LawAmendmentMutationIssue = MutationIssue;

export const {
  ErrorClass: LawAmendmentMutationError,
  isError: isLawAmendmentMutationError,
} = createMutationError<LawAmendmentMutationErrorCode>(
  "LawAmendmentMutationError",
);
export type LawAmendmentMutationError = InstanceType<
  typeof LawAmendmentMutationError
>;

function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.output<TSchema> {
  return parseMutationInput(
    schema,
    input,
    (issues) =>
      new LawAmendmentMutationError({
        code: "law_amendment_input_invalid",
        issues,
        message: "Amendment input is invalid.",
      }),
  );
}

// Every write here can move the document's current_version/article set
// (decree instant-apply, or a vote-kind proposal that passes immediately on
// cast) -- invalidate the law-documents queries alongside the amendment
// queries so both features' caches stay in sync without a page reload.
function invalidateAmendmentAndDocumentQueries(
  queryClient: QueryClient,
  {
    amendmentId,
    documentId,
  }: { readonly amendmentId: string | null; readonly documentId: string },
): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: lawAmendmentsQueryKeys.forDocument(documentId),
    }),
    amendmentId === null
      ? Promise.resolve()
      : queryClient.invalidateQueries({
          queryKey: lawAmendmentsQueryKeys.votes(amendmentId),
        }),
    queryClient.invalidateQueries({
      queryKey: lawDocumentsQueryKeys.articles(documentId),
    }),
    queryClient.invalidateQueries({
      queryKey: lawDocumentsQueryKeys.versions(documentId),
    }),
  ]).then(() => undefined);
}

type ProposeLawAmendmentRow =
  Database["public"]["Functions"]["propose_law_amendment"]["Returns"];

function toLawAmendment(row: ProposeLawAmendmentRow): LawAmendment {
  return {
    createdAt: row.created_at,
    deadlineTurnNumber: row.deadline_turn_number,
    documentId: row.document_id,
    id: row.id,
    operations: row.operations_json,
    proposedByCitizenId: row.proposed_by_citizen_id,
    proposedTurnNumber: row.proposed_turn_number,
    rationaleMarkdown: row.rationale_markdown,
    resolvedTurnNumber: row.resolved_turn_number,
    status: row.status as LawAmendment["status"],
    title: row.title,
    updatedAt: row.updated_at,
  };
}

export type ProposeLawAmendmentMutationOptions = UseMutationOptions<
  LawAmendment,
  AuthUiError | LawAmendmentMutationError,
  ProposeLawAmendmentInput
>;

export function proposeLawAmendmentMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): ProposeLawAmendmentMutationOptions {
  return mutationOptions({
    mutationFn: (input: ProposeLawAmendmentInput) =>
      proposeLawAmendment(client, input),
    mutationKey: [...lawAmendmentsQueryKeys.all, "propose-law-amendment"],
    onSuccess: (result, input) =>
      invalidateAmendmentAndDocumentQueries(queryClient, {
        amendmentId: result.id,
        documentId: input.documentId,
      }),
  });
}

async function proposeLawAmendment(
  client: GubernatorSupabaseClient,
  input: ProposeLawAmendmentInput,
): Promise<LawAmendment> {
  const values = parseInput(proposeLawAmendmentInputSchema, input);

  const { data, error } = await client
    .rpc("propose_law_amendment", {
      p_document_id: values.documentId,
      p_operations_json: values.operations as Json,
      p_proposing_citizen_id: values.proposingCitizenId,
      // Generated types don't reflect the nullable parameter; null is valid.
      p_rationale_markdown: values.rationaleMarkdown as string,
      p_title: values.title,
    })
    .single();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return toLawAmendment(data);
}

type CastLawAmendmentVoteRow =
  Database["public"]["Functions"]["cast_law_amendment_vote"]["Returns"];

function toLawAmendmentVote(row: CastLawAmendmentVoteRow): LawAmendmentVote {
  return {
    amendmentId: row.amendment_id,
    castByUserId: row.cast_by_user_id,
    createdAt: row.created_at,
    id: row.id,
    vote: row.vote,
    voterCitizenId: row.voter_citizen_id,
  };
}

export type CastLawAmendmentVoteMutationOptions = UseMutationOptions<
  LawAmendmentVote,
  AuthUiError | LawAmendmentMutationError,
  CastLawAmendmentVoteInput & { readonly documentId: string }
>;

export function castLawAmendmentVoteMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): CastLawAmendmentVoteMutationOptions {
  return mutationOptions({
    mutationFn: (
      input: CastLawAmendmentVoteInput & { readonly documentId: string },
    ) => castLawAmendmentVote(client, input),
    mutationKey: [...lawAmendmentsQueryKeys.all, "cast-law-amendment-vote"],
    onSuccess: (_result, input) =>
      invalidateAmendmentAndDocumentQueries(queryClient, {
        amendmentId: input.amendmentId,
        documentId: input.documentId,
      }),
  });
}

async function castLawAmendmentVote(
  client: GubernatorSupabaseClient,
  input: CastLawAmendmentVoteInput & { readonly documentId: string },
): Promise<LawAmendmentVote> {
  // documentId is only needed for cache invalidation (onSuccess above); the
  // RPC schema is strict, so it must not see this extra field.
  const { documentId: _documentId, ...voteInput } = input;
  const values = parseInput(castLawAmendmentVoteInputSchema, voteInput);

  const { data, error } = await client
    .rpc("cast_law_amendment_vote", {
      p_amendment_id: values.amendmentId,
      p_vote: values.vote,
      p_voter_citizen_id: values.voterCitizenId,
    })
    .single();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return toLawAmendmentVote(data);
}

export type WithdrawLawAmendmentMutationOptions = UseMutationOptions<
  LawAmendment,
  AuthUiError | LawAmendmentMutationError,
  WithdrawLawAmendmentInput & { readonly documentId: string }
>;

export function withdrawLawAmendmentMutationOptions({
  client = requireSupabaseClient(),
  queryClient,
}: {
  readonly client?: GubernatorSupabaseClient;
  readonly queryClient: QueryClient;
}): WithdrawLawAmendmentMutationOptions {
  return mutationOptions({
    mutationFn: (
      input: WithdrawLawAmendmentInput & { readonly documentId: string },
    ) => withdrawLawAmendment(client, input),
    mutationKey: [...lawAmendmentsQueryKeys.all, "withdraw-law-amendment"],
    onSuccess: (result, input) =>
      invalidateAmendmentAndDocumentQueries(queryClient, {
        amendmentId: result.id,
        documentId: input.documentId,
      }),
  });
}

async function withdrawLawAmendment(
  client: GubernatorSupabaseClient,
  input: WithdrawLawAmendmentInput & { readonly documentId: string },
): Promise<LawAmendment> {
  // documentId is only needed for cache invalidation (onSuccess above); the
  // RPC schema is strict, so it must not see this extra field.
  const { documentId: _documentId, ...withdrawInput } = input;
  const values = parseInput(withdrawLawAmendmentInputSchema, withdrawInput);

  const { data, error } = await client
    .rpc("withdraw_law_amendment", {
      p_amendment_id: values.amendmentId,
    })
    .single();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return toLawAmendment(data);
}
