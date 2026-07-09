import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { GovernmentBody } from "@/features/government-bodies";
import type { LawArticle } from "@/features/law-documents";
import { ArticleDiffRow, diffArticles } from "@/features/law-documents";
import type { OfficeType } from "@/features/nations";

import { SetProcedureEditor } from "./SetProcedureEditor";

import type { OperationDraft } from "../utils/buildAmendmentOperations";
import type { JSX } from "react";

// One operation row's editor + live preview inside the composer (#1120).
// add_article/amend_article previews reuse ArticleDiffRow/diffArticles from
// law-documents' version browser so amendment previews render identically
// to the version history's diff.
export function OperationEditor({
  articles,
  bodies,
  draft,
  officeTypes,
  onChange,
  onRemove,
}: {
  readonly articles: readonly LawArticle[];
  readonly bodies: readonly GovernmentBody[];
  readonly draft: OperationDraft;
  readonly officeTypes: readonly OfficeType[];
  readonly onChange: (draft: OperationDraft) => void;
  readonly onRemove: () => void;
}): JSX.Element {
  return (
    <li className="grid gap-2 rounded-md border border-border p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {OPERATION_LABELS[draft.op]}
        </span>
        <Button type="button" variant="outline" size="sm" onClick={onRemove}>
          Remove
        </Button>
      </div>

      {draft.op === "add_article" ? (
        <AddArticleEditor draft={draft} onChange={onChange} />
      ) : null}
      {draft.op === "amend_article" ? (
        <AmendArticleEditor
          articles={articles}
          draft={draft}
          onChange={onChange}
        />
      ) : null}
      {draft.op === "repeal_article" ? (
        <RepealArticleEditor
          articles={articles}
          draft={draft}
          onChange={onChange}
        />
      ) : null}
      {draft.op === "set_procedure" ? (
        <SetProcedureEditor
          bodies={bodies}
          officeTypes={officeTypes}
          onChange={(procedure) => {
            if (procedure !== null) {
              onChange({ key: draft.key, op: "set_procedure", procedure });
            }
          }}
        />
      ) : null}
    </li>
  );
}

const OPERATION_LABELS: Readonly<Record<OperationDraft["op"], string>> = {
  add_article: "Add article",
  amend_article: "Amend article",
  repeal_article: "Repeal article",
  set_procedure: "Change amendment procedure",
};

function AddArticleEditor({
  draft,
  onChange,
}: {
  readonly draft: Extract<OperationDraft, { readonly op: "add_article" }>;
  readonly onChange: (draft: OperationDraft) => void;
}): JSX.Element {
  return (
    <div className="grid gap-2">
      <Input
        value={draft.heading}
        onChange={(e) => onChange({ ...draft, heading: e.target.value })}
        placeholder="Heading"
      />
      <Textarea
        value={draft.bodyMarkdown}
        onChange={(e) => onChange({ ...draft, bodyMarkdown: e.target.value })}
        placeholder="Body"
        rows={3}
      />
      <div className="grid gap-1">
        <Label htmlFor={`${draft.key}-position`}>
          Insert position (optional, defaults to end)
        </Label>
        <Input
          id={`${draft.key}-position`}
          type="number"
          min={1}
          value={draft.position ?? ""}
          onChange={(e) =>
            onChange({
              ...draft,
              position: e.target.value === "" ? null : Number(e.target.value),
            })
          }
        />
      </div>
      {draft.heading.trim() !== "" || draft.bodyMarkdown.trim() !== "" ? (
        <div className="rounded-md border border-dashed border-border p-2">
          <p className="text-xs text-muted-foreground">Preview</p>
          <h3 className="text-sm font-medium">
            {draft.heading.trim() === "" ? "(untitled)" : draft.heading}
          </h3>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {draft.bodyMarkdown}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function AmendArticleEditor({
  articles,
  draft,
  onChange,
}: {
  readonly articles: readonly LawArticle[];
  readonly draft: Extract<OperationDraft, { readonly op: "amend_article" }>;
  readonly onChange: (draft: OperationDraft) => void;
}): JSX.Element {
  const original = articles.find((article) => article.id === draft.articleId);

  return (
    <div className="grid gap-2">
      <Select
        value={draft.articleId}
        onValueChange={(articleId) => {
          const article = articles.find((a) => a.id === articleId);
          onChange({
            ...draft,
            articleId,
            heading: article?.heading ?? draft.heading,
            bodyMarkdown: article?.bodyMarkdown ?? draft.bodyMarkdown,
          });
        }}
      >
        <SelectTrigger aria-label="Article to amend">
          <SelectValue placeholder="Select an article" />
        </SelectTrigger>
        <SelectContent>
          {articles.map((article) => (
            <SelectItem key={article.id} value={article.id}>
              Article {article.articleNumber}. {article.heading}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        value={draft.heading}
        onChange={(e) => onChange({ ...draft, heading: e.target.value })}
        placeholder="Heading"
      />
      <Textarea
        value={draft.bodyMarkdown}
        onChange={(e) => onChange({ ...draft, bodyMarkdown: e.target.value })}
        placeholder="Body"
        rows={3}
      />
      {original !== undefined ? (
        <div className="rounded-md border border-dashed border-border p-2">
          <p className="text-xs text-muted-foreground">Preview</p>
          <ArticleDiffRow
            diff={
              diffArticles(
                [
                  {
                    articleNumber: original.articleNumber,
                    bodyMarkdown: original.bodyMarkdown,
                    heading: original.heading,
                    sortOrder: original.sortOrder,
                    status: original.status,
                  },
                ],
                [
                  {
                    articleNumber: original.articleNumber,
                    bodyMarkdown: draft.bodyMarkdown,
                    heading: draft.heading,
                    sortOrder: original.sortOrder,
                    status: original.status,
                  },
                ],
              )[0]
            }
          />
        </div>
      ) : null}
    </div>
  );
}

function RepealArticleEditor({
  articles,
  draft,
  onChange,
}: {
  readonly articles: readonly LawArticle[];
  readonly draft: Extract<OperationDraft, { readonly op: "repeal_article" }>;
  readonly onChange: (draft: OperationDraft) => void;
}): JSX.Element {
  const article = articles.find((a) => a.id === draft.articleId);

  return (
    <div className="grid gap-2">
      <Select
        value={draft.articleId}
        onValueChange={(articleId) => onChange({ ...draft, articleId })}
      >
        <SelectTrigger aria-label="Article to repeal">
          <SelectValue placeholder="Select an article" />
        </SelectTrigger>
        <SelectContent>
          {articles.map((a) => (
            <SelectItem key={a.id} value={a.id}>
              Article {a.articleNumber}. {a.heading}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {article !== undefined ? (
        <div className="rounded-md border border-dashed border-border p-2">
          <p className="text-xs text-muted-foreground">Preview</p>
          <h3 className="text-sm font-medium text-muted-foreground line-through">
            Article {article.articleNumber}. {article.heading}
          </h3>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground line-through">
            {article.bodyMarkdown}
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Select an article.</p>
      )}
    </div>
  );
}
