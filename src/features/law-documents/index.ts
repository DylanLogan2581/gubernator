// Law documents feature (#1117): DM-reference books of law for a nation or
// settlement -- title + preamble + versioned articles, with a version-1
// snapshot on creation and a per-article diff browser across versions.
// Zero simulation effects; every write is RPC-only.
export {
  LawDocumentsSection,
  type LawDocumentsSectionProps,
} from "./components/LawDocumentsSection";
export {
  ArticleDiffRow,
  diffArticles,
  LawDocumentVersionBrowser,
  TextDiff,
} from "./components/LawDocumentVersionBrowser";
export type {
  ArticleDiff,
  ArticleDiffStatus,
} from "./components/LawDocumentVersionBrowser";
export {
  createLawDocumentMutationOptions,
  isLawDocumentMutationError,
  LawDocumentMutationError,
  repealLawDocumentMutationOptions,
} from "./mutations/lawDocumentsMutations";
export type { LawDocumentMutationIssue } from "./mutations/lawDocumentsMutations";
export {
  lawDocumentArticlesQueryOptions,
  lawDocumentVersionsQueryOptions,
  nationLawDocumentsQueryOptions,
  settlementLawDocumentsQueryOptions,
} from "./queries/lawDocumentsQueries";
export { lawDocumentsQueryKeys } from "./queries/lawDocumentsQueryKeys";
export {
  createLawDocumentInputSchema,
  lawDocumentArticleInputSchema,
  repealLawDocumentInputSchema,
} from "./schemas/lawDocumentSchemas";
export type {
  CreateLawDocumentInput,
  CreateLawDocumentValues,
  RepealLawDocumentInput,
} from "./schemas/lawDocumentSchemas";
export type {
  LawArticle,
  LawArticleSnapshot,
  LawDocument,
  LawDocumentArticleInput,
  LawDocumentStatus,
  LawDocumentVersion,
} from "./types/lawDocumentTypes";
