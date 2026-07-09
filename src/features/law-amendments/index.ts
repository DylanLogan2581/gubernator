// Law amendments feature (#1120): proposal composer, decree signing, voting,
// and best-effort version linking on top of law-documents (#1117) and
// government-bodies (#1116). Every write is RPC-only
// (propose_law_amendment, cast_law_amendment_vote, withdraw_law_amendment).
export { AmendmentsSection } from "./components/AmendmentsSection";
export type { AmendmentsSectionProps } from "./components/AmendmentsSection";
export {
  castLawAmendmentVoteMutationOptions,
  isLawAmendmentMutationError,
  LawAmendmentMutationError,
  proposeLawAmendmentMutationOptions,
  withdrawLawAmendmentMutationOptions,
} from "./mutations/lawAmendmentsMutations";
export type { LawAmendmentMutationIssue } from "./mutations/lawAmendmentsMutations";
export { lawAmendmentsAwaitingMyVoteCountQueryOptions } from "./queries/lawAmendmentsBadgeQueries";
export {
  lawAmendmentsForDocumentQueryOptions,
  lawAmendmentVotesQueryOptions,
} from "./queries/lawAmendmentsQueries";
export { lawAmendmentsQueryKeys } from "./queries/lawAmendmentsQueryKeys";
export {
  castLawAmendmentVoteInputSchema,
  proposeLawAmendmentInputSchema,
  withdrawLawAmendmentInputSchema,
} from "./schemas/lawAmendmentSchemas";
export type {
  CastLawAmendmentVoteInput,
  ProposeLawAmendmentInput,
  ProposeLawAmendmentValues,
  WithdrawLawAmendmentInput,
} from "./schemas/lawAmendmentSchemas";
export type {
  AddArticleOperationInput,
  AmendArticleOperationInput,
  AmendmentOperationInput,
  LawAmendment,
  LawAmendmentStatus,
  LawAmendmentVote,
  RepealArticleOperationInput,
  SetProcedureOperationInput,
} from "./types/lawAmendmentTypes";
