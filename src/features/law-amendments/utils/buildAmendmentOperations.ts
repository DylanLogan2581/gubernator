import type { AmendmentProcedure } from "@/shared/government";

import type {
  AddArticleOperationInput,
  AmendArticleOperationInput,
  AmendmentOperationInput,
  RepealArticleOperationInput,
  SetProcedureOperationInput,
} from "../types/lawAmendmentTypes";

// Composer form state for one operation row, one variant per op kind --
// camelCase like the rest of this codebase's component state. Converting to
// the RPC's snake_case operations_json shape is the one acceptance-critical
// piece of the composer (#1120), so it's split into its own pure module and
// unit-tested directly rather than only through component rendering.
export type OperationDraft =
  | {
      readonly key: string;
      readonly op: "add_article";
      readonly heading: string;
      readonly bodyMarkdown: string;
      readonly position: number | null;
    }
  | {
      readonly key: string;
      readonly op: "amend_article";
      readonly articleId: string;
      readonly heading: string;
      readonly bodyMarkdown: string;
    }
  | {
      readonly key: string;
      readonly op: "repeal_article";
      readonly articleId: string;
    }
  | {
      readonly key: string;
      readonly op: "set_procedure";
      readonly procedure: AmendmentProcedure;
    };

function toAddArticleOperation(
  draft: Extract<OperationDraft, { readonly op: "add_article" }>,
): AddArticleOperationInput {
  return {
    op: "add_article",
    heading: draft.heading,
    body_markdown: draft.bodyMarkdown,
    ...(draft.position === null ? {} : { position: draft.position }),
  };
}

function toAmendArticleOperation(
  draft: Extract<OperationDraft, { readonly op: "amend_article" }>,
): AmendArticleOperationInput {
  return {
    op: "amend_article",
    article_id: draft.articleId,
    heading: draft.heading,
    body_markdown: draft.bodyMarkdown,
  };
}

function toRepealArticleOperation(
  draft: Extract<OperationDraft, { readonly op: "repeal_article" }>,
): RepealArticleOperationInput {
  return { op: "repeal_article", article_id: draft.articleId };
}

function toSetProcedureOperation(
  draft: Extract<OperationDraft, { readonly op: "set_procedure" }>,
): SetProcedureOperationInput {
  return { op: "set_procedure", procedure: draft.procedure };
}

export function toOperationInput(
  draft: OperationDraft,
): AmendmentOperationInput {
  switch (draft.op) {
    case "add_article":
      return toAddArticleOperation(draft);
    case "amend_article":
      return toAmendArticleOperation(draft);
    case "repeal_article":
      return toRepealArticleOperation(draft);
    case "set_procedure":
      return toSetProcedureOperation(draft);
  }
}

// Builds the operations_json payload sent as-is to propose_law_amendment.
// Order is preserved -- an omnibus amendment applies its operations in the
// order given.
export function buildAmendmentOperations(
  drafts: readonly OperationDraft[],
): readonly AmendmentOperationInput[] {
  return drafts.map(toOperationInput);
}
