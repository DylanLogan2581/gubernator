import { queryOptions, type UseQueryOptions } from "@tanstack/react-query";

import { normalizeSupabaseError, type AuthUiError } from "@/features/auth";
import {
  requireSupabaseClient,
  type GubernatorSupabaseClient,
} from "@/lib/supabase";
import { validateAmendmentProcedure } from "@/shared/government";

import { lawDocumentsQueryKeys } from "./lawDocumentsQueryKeys";

import type {
  LawArticle,
  LawArticleSnapshot,
  LawDocument,
  LawDocumentStatus,
  LawDocumentVersion,
} from "../types/lawDocumentTypes";

const LAW_DOCUMENT_SELECT =
  "id,world_id,nation_id,settlement_id,title,preamble_markdown,status,amendment_procedure_json,current_version,created_turn_number,created_at,updated_at";

type LawDocumentRow = {
  readonly amendment_procedure_json: unknown;
  readonly created_at: string;
  readonly created_turn_number: number;
  readonly current_version: number;
  readonly id: string;
  readonly nation_id: string | null;
  readonly preamble_markdown: string | null;
  readonly settlement_id: string | null;
  readonly status: LawDocumentStatus;
  readonly title: string;
  readonly updated_at: string;
  readonly world_id: string;
};

function toLawDocument(row: LawDocumentRow): LawDocument {
  return {
    amendmentProcedure: validateAmendmentProcedure(
      row.amendment_procedure_json,
    ),
    createdAt: row.created_at,
    createdTurnNumber: row.created_turn_number,
    currentVersion: row.current_version,
    id: row.id,
    nationId: row.nation_id,
    preambleMarkdown: row.preamble_markdown,
    settlementId: row.settlement_id,
    status: row.status,
    title: row.title,
    updatedAt: row.updated_at,
    worldId: row.world_id,
  };
}

type LawDocumentListQueryOptions<TKey extends readonly unknown[]> =
  UseQueryOptions<
    readonly LawDocument[],
    AuthUiError,
    readonly LawDocument[],
    TKey
  >;

export function nationLawDocumentsQueryOptions(
  nationId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): LawDocumentListQueryOptions<
  ReturnType<typeof lawDocumentsQueryKeys.nationList>
> {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getNationLawDocuments(client, nationId),
    queryKey: lawDocumentsQueryKeys.nationList(nationId),
  });
}

async function getNationLawDocuments(
  client: GubernatorSupabaseClient,
  nationId: string,
): Promise<readonly LawDocument[]> {
  const { data, error } = await client
    .from("law_documents")
    .select(LAW_DOCUMENT_SELECT)
    .eq("nation_id", nationId)
    .order("title")
    .returns<LawDocumentRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toLawDocument);
}

export function settlementLawDocumentsQueryOptions(
  settlementId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): LawDocumentListQueryOptions<
  ReturnType<typeof lawDocumentsQueryKeys.settlementList>
> {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getSettlementLawDocuments(client, settlementId),
    queryKey: lawDocumentsQueryKeys.settlementList(settlementId),
  });
}

async function getSettlementLawDocuments(
  client: GubernatorSupabaseClient,
  settlementId: string,
): Promise<readonly LawDocument[]> {
  const { data, error } = await client
    .from("law_documents")
    .select(LAW_DOCUMENT_SELECT)
    .eq("settlement_id", settlementId)
    .order("title")
    .returns<LawDocumentRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toLawDocument);
}

type LawArticleRow = {
  readonly article_number: number;
  readonly body_markdown: string;
  readonly document_id: string;
  readonly heading: string;
  readonly id: string;
  readonly sort_order: number;
  readonly status: LawDocumentStatus;
};

function toLawArticle(row: LawArticleRow): LawArticle {
  return {
    articleNumber: row.article_number,
    bodyMarkdown: row.body_markdown,
    documentId: row.document_id,
    heading: row.heading,
    id: row.id,
    sortOrder: row.sort_order,
    status: row.status,
  };
}

// The document's current article set (all statuses -- callers filter to
// "active" for display, since a repealed article's history still matters
// for the version browser).
export function lawDocumentArticlesQueryOptions(
  documentId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): UseQueryOptions<
  readonly LawArticle[],
  AuthUiError,
  readonly LawArticle[],
  ReturnType<typeof lawDocumentsQueryKeys.articles>
> {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getLawDocumentArticles(client, documentId),
    queryKey: lawDocumentsQueryKeys.articles(documentId),
  });
}

async function getLawDocumentArticles(
  client: GubernatorSupabaseClient,
  documentId: string,
): Promise<readonly LawArticle[]> {
  const { data, error } = await client
    .from("law_articles")
    .select(
      "article_number,body_markdown,document_id,heading,id,sort_order,status",
    )
    .eq("document_id", documentId)
    .order("sort_order")
    .returns<LawArticleRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toLawArticle);
}

type LawDocumentVersionRow = {
  readonly amendment_title: string;
  readonly articles_snapshot_json: readonly LawArticleSnapshot[];
  readonly created_at: string;
  readonly document_id: string;
  readonly enacted_by_citizen_id: string | null;
  readonly enacted_turn_number: number;
  readonly id: string;
  readonly version: number;
};

function toLawDocumentVersion(row: LawDocumentVersionRow): LawDocumentVersion {
  return {
    amendmentTitle: row.amendment_title,
    articlesSnapshot: row.articles_snapshot_json,
    createdAt: row.created_at,
    documentId: row.document_id,
    enactedByCitizenId: row.enacted_by_citizen_id,
    enactedTurnNumber: row.enacted_turn_number,
    id: row.id,
    version: row.version,
  };
}

export function lawDocumentVersionsQueryOptions(
  documentId: string,
  client: GubernatorSupabaseClient = requireSupabaseClient(),
): UseQueryOptions<
  readonly LawDocumentVersion[],
  AuthUiError,
  readonly LawDocumentVersion[],
  ReturnType<typeof lawDocumentsQueryKeys.versions>
> {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return queryOptions({
    queryFn: () => getLawDocumentVersions(client, documentId),
    queryKey: lawDocumentsQueryKeys.versions(documentId),
  });
}

async function getLawDocumentVersions(
  client: GubernatorSupabaseClient,
  documentId: string,
): Promise<readonly LawDocumentVersion[]> {
  const { data, error } = await client
    .from("law_document_versions")
    .select(
      "amendment_title,articles_snapshot_json,created_at,document_id,enacted_by_citizen_id,enacted_turn_number,id,version",
    )
    .eq("document_id", documentId)
    .order("version", { ascending: false })
    .returns<LawDocumentVersionRow[]>();

  if (error !== null) {
    throw normalizeSupabaseError(error);
  }

  return data.map(toLawDocumentVersion);
}
