import { describe, expect, it } from "vitest";

import {
  buildAmendmentOperations,
  type OperationDraft,
} from "./buildAmendmentOperations";

describe("buildAmendmentOperations", () => {
  it("builds an add_article operation, omitting position when unset", () => {
    const drafts: readonly OperationDraft[] = [
      {
        key: "a",
        op: "add_article",
        heading: "Of Trade",
        bodyMarkdown: "Trade shall be free.",
        position: null,
      },
    ];

    expect(buildAmendmentOperations(drafts)).toEqual([
      {
        op: "add_article",
        heading: "Of Trade",
        body_markdown: "Trade shall be free.",
      },
    ]);
  });

  it("builds an add_article operation with a position", () => {
    const drafts: readonly OperationDraft[] = [
      {
        key: "a",
        op: "add_article",
        heading: "Of Trade",
        bodyMarkdown: "Trade shall be free.",
        position: 2,
      },
    ];

    expect(buildAmendmentOperations(drafts)).toEqual([
      {
        op: "add_article",
        heading: "Of Trade",
        body_markdown: "Trade shall be free.",
        position: 2,
      },
    ]);
  });

  it("builds an amend_article operation", () => {
    const drafts: readonly OperationDraft[] = [
      {
        key: "a",
        op: "amend_article",
        articleId: "article-1",
        heading: "Of Trade (revised)",
        bodyMarkdown: "Trade shall be regulated.",
      },
    ];

    expect(buildAmendmentOperations(drafts)).toEqual([
      {
        op: "amend_article",
        article_id: "article-1",
        heading: "Of Trade (revised)",
        body_markdown: "Trade shall be regulated.",
      },
    ]);
  });

  it("builds a repeal_article operation", () => {
    const drafts: readonly OperationDraft[] = [
      { key: "a", op: "repeal_article", articleId: "article-1" },
    ];

    expect(buildAmendmentOperations(drafts)).toEqual([
      { op: "repeal_article", article_id: "article-1" },
    ]);
  });

  it("builds a set_procedure operation", () => {
    const drafts: readonly OperationDraft[] = [
      {
        key: "a",
        op: "set_procedure",
        procedure: { kind: "decree", authority: "ruler" },
      },
    ];

    expect(buildAmendmentOperations(drafts)).toEqual([
      {
        op: "set_procedure",
        procedure: { kind: "decree", authority: "ruler" },
      },
    ]);
  });

  it("preserves operation order across an omnibus amendment", () => {
    const drafts: readonly OperationDraft[] = [
      { key: "a", op: "repeal_article", articleId: "article-1" },
      {
        key: "b",
        op: "add_article",
        heading: "Of Coin",
        bodyMarkdown: "Coin shall be minted.",
        position: null,
      },
    ];

    const operations = buildAmendmentOperations(drafts);

    expect(operations.map((operation) => operation.op)).toEqual([
      "repeal_article",
      "add_article",
    ]);
  });
});
