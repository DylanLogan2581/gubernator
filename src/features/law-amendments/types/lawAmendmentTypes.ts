import type { AmendmentProcedure } from "@/shared/government";

// #1120: proposals against a law document's current article set, resolved
// either by instant decree apply or by a body vote -- see
// supabase/migrations/20261007000001_add_law_amendments.sql for the RPCs
// that own every write (propose_law_amendment, cast_law_amendment_vote,
// withdraw_law_amendment). This feature is read-plus-RPC-only, same as
// law-documents.
export type LawAmendmentStatus =
  | "proposed"
  | "passed"
  | "failed"
  | "withdrawn"
  | "expired";

export type LawAmendment = {
  readonly id: string;
  readonly documentId: string;
  readonly title: string;
  readonly rationaleMarkdown: string | null;
  readonly operations: unknown;
  readonly status: LawAmendmentStatus;
  readonly proposedByCitizenId: string;
  readonly proposedTurnNumber: number;
  readonly deadlineTurnNumber: number | null;
  readonly resolvedTurnNumber: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type LawAmendmentVote = {
  readonly id: string;
  readonly amendmentId: string;
  readonly voterCitizenId: string;
  readonly vote: boolean;
  readonly castByUserId: string | null;
  readonly createdAt: string;
};

// operations_json array entries -- snake_case field names matching the
// propose_law_amendment RPC exactly, since these are sent as-is via
// p_operations_json (see AGENTS.md task spec for the exact shapes).
export type AddArticleOperationInput = {
  readonly op: "add_article";
  readonly heading: string;
  readonly body_markdown: string;
  readonly position?: number;
};

export type AmendArticleOperationInput = {
  readonly op: "amend_article";
  readonly article_id: string;
  readonly heading: string;
  readonly body_markdown: string;
};

export type RepealArticleOperationInput = {
  readonly op: "repeal_article";
  readonly article_id: string;
};

export type SetProcedureOperationInput = {
  readonly op: "set_procedure";
  readonly procedure: AmendmentProcedure;
};

export type AmendmentOperationInput =
  | AddArticleOperationInput
  | AmendArticleOperationInput
  | RepealArticleOperationInput
  | SetProcedureOperationInput;
