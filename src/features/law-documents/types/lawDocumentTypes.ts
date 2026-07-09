// #1117: a nation or settlement's book of law -- title + preamble + a
// versioned set of articles. Exactly one of nationId / settlementId is set,
// matching the DB scope-exclusive check. DM-reference only, zero simulation
// effects.
export type LawDocumentStatus = "active" | "repealed";

export type LawDocument = {
  readonly amendmentProcedure: unknown;
  readonly createdAt: string;
  readonly createdTurnNumber: number;
  readonly currentVersion: number;
  readonly id: string;
  readonly nationId: string | null;
  readonly preambleMarkdown: string | null;
  readonly settlementId: string | null;
  readonly status: LawDocumentStatus;
  readonly title: string;
  readonly updatedAt: string;
  readonly worldId: string;
};

// Current article state (law_articles). articleNumber is a stable identity,
// never reused across amendments.
export type LawArticle = {
  readonly articleNumber: number;
  readonly bodyMarkdown: string;
  readonly documentId: string;
  readonly heading: string;
  // The law_articles row id -- needed by amend_article/repeal_article
  // amendment operations (#1120), which reference an article by its DB row
  // id, not its stable articleNumber.
  readonly id: string;
  readonly sortOrder: number;
  readonly status: LawDocumentStatus;
};

// A single article as captured in a law_document_versions snapshot -- shape
// matches the jsonb_build_object() written by create_law_document (and, in
// the amendments issue, the amend RPC).
export type LawArticleSnapshot = {
  readonly articleNumber: number;
  readonly bodyMarkdown: string;
  readonly heading: string;
  readonly sortOrder: number;
  readonly status: LawDocumentStatus;
};

export type LawDocumentVersion = {
  readonly amendmentTitle: string;
  readonly articlesSnapshot: readonly LawArticleSnapshot[];
  readonly createdAt: string;
  readonly documentId: string;
  readonly enactedByCitizenId: string | null;
  readonly enactedTurnNumber: number;
  readonly id: string;
  readonly version: number;
};

// Input shape for create_law_document's p_articles jsonb array.
export type LawDocumentArticleInput = {
  readonly bodyMarkdown: string;
  readonly heading: string;
};
