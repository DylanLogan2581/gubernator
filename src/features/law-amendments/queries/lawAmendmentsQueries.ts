import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";

import { lawAmendmentsQueryKeys } from "./lawAmendmentsQueryKeys";

import type {
  LawAmendment,
  LawAmendmentVote,
} from "../types/lawAmendmentTypes";

const LAW_AMENDMENT_SELECT =
  "id,document_id,title,rationale_markdown,operations_json,status,proposed_by_citizen_id,proposed_turn_number,deadline_turn_number,resolved_turn_number,enacted_version,created_at,updated_at";

type LawAmendmentRow = {
  readonly created_at: string;
  readonly deadline_turn_number: number | null;
  readonly document_id: string;
  readonly enacted_version: number | null;
  readonly id: string;
  readonly operations_json: unknown;
  readonly proposed_by_citizen_id: string;
  readonly proposed_turn_number: number;
  readonly rationale_markdown: string | null;
  readonly resolved_turn_number: number | null;
  readonly status: LawAmendment["status"];
  readonly title: string;
  readonly updated_at: string;
};

function toLawAmendment(row: LawAmendmentRow): LawAmendment {
  return {
    createdAt: row.created_at,
    deadlineTurnNumber: row.deadline_turn_number,
    documentId: row.document_id,
    enactedVersion: row.enacted_version,
    id: row.id,
    operations: row.operations_json,
    proposedByCitizenId: row.proposed_by_citizen_id,
    proposedTurnNumber: row.proposed_turn_number,
    rationaleMarkdown: row.rationale_markdown,
    resolvedTurnNumber: row.resolved_turn_number,
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at,
  };
}

export function lawAmendmentsForDocumentQueryOptions(
  documentId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): UseQueryOptions<
  readonly LawAmendment[],
  AuthUiError,
  readonly LawAmendment[],
  ReturnType<typeof lawAmendmentsQueryKeys.forDocument>
> {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getLawAmendmentsForDocument(client, documentId),
    queryKey: lawAmendmentsQueryKeys.forDocument(documentId),
  });
}

async function getLawAmendmentsForDocument(
  client: GubernatorSupabaseClient,
  documentId: string,
): Promise<readonly LawAmendment[]> {
  const { data, error } = await client
    .from("law_amendments")
    .select(LAW_AMENDMENT_SELECT)
    .eq("document_id", documentId)
    .order("proposed_turn_number", { ascending: false })
    .returns<LawAmendmentRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toLawAmendment);
}

type LawAmendmentVoteRow = {
  readonly amendment_id: string;
  readonly cast_by_user_id: string | null;
  readonly created_at: string;
  readonly id: string;
  readonly vote: boolean;
  readonly voter_citizen_id: string;
};

function toLawAmendmentVote(row: LawAmendmentVoteRow): LawAmendmentVote {
  return {
    amendmentId: row.amendment_id,
    castByUserId: row.cast_by_user_id,
    createdAt: row.created_at,
    id: row.id,
    vote: row.vote,
    voterCitizenId: row.voter_citizen_id,
  };
}

export function lawAmendmentVotesQueryOptions(
  amendmentId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): UseQueryOptions<
  readonly LawAmendmentVote[],
  AuthUiError,
  readonly LawAmendmentVote[],
  ReturnType<typeof lawAmendmentsQueryKeys.votes>
> {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getLawAmendmentVotes(client, amendmentId),
    queryKey: lawAmendmentsQueryKeys.votes(amendmentId),
  });
}

async function getLawAmendmentVotes(
  client: GubernatorSupabaseClient,
  amendmentId: string,
): Promise<readonly LawAmendmentVote[]> {
  const { data, error } = await client
    .from("law_amendment_votes")
    .select("amendment_id,cast_by_user_id,created_at,id,vote,voter_citizen_id")
    .eq("amendment_id", amendmentId)
    .returns<LawAmendmentVoteRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toLawAmendmentVote);
}
