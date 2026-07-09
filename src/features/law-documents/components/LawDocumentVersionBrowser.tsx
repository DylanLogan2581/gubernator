import { useQuery } from "@tanstack/react-query";
import { diffWords } from "diff";
import { useMemo, useState, type JSX } from "react";

import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getErrorDescription } from "@/lib/errorUtils";

import { lawDocumentVersionsQueryOptions } from "../queries/lawDocumentsQueries";

import type { LawArticleSnapshot } from "../types/lawDocumentTypes";

export type LawDocumentVersionBrowserProps = {
  readonly documentId: string;
  readonly documentTitle: string;
  readonly onClose: () => void;
};

type ArticleDiffStatus = "added" | "changed" | "removed" | "unchanged";

type ArticleDiff = {
  readonly articleNumber: number;
  readonly from: LawArticleSnapshot | null;
  readonly status: ArticleDiffStatus;
  readonly to: LawArticleSnapshot | null;
};

const STATUS_LABELS: Readonly<Record<ArticleDiffStatus, string>> = {
  added: "Added",
  changed: "Changed",
  removed: "Removed",
  unchanged: "Unchanged",
};

const STATUS_BADGE_VARIANTS: Readonly<
  Record<ArticleDiffStatus, "success" | "warning" | "destructive" | "secondary">
> = {
  added: "success",
  changed: "warning",
  removed: "destructive",
  unchanged: "secondary",
};

function diffArticles(
  from: readonly LawArticleSnapshot[],
  to: readonly LawArticleSnapshot[],
): readonly ArticleDiff[] {
  const fromByNumber = new Map(
    from.map((article) => [article.articleNumber, article] as const),
  );
  const toByNumber = new Map(
    to.map((article) => [article.articleNumber, article] as const),
  );
  const articleNumbers = [
    ...new Set([...fromByNumber.keys(), ...toByNumber.keys()]),
  ].sort((a, b) => a - b);

  return articleNumbers.map((articleNumber) => {
    const fromArticle = fromByNumber.get(articleNumber) ?? null;
    const toArticle = toByNumber.get(articleNumber) ?? null;

    let status: ArticleDiffStatus;
    if (fromArticle === null) {
      status = "added";
    } else if (toArticle === null) {
      status = "removed";
    } else if (
      fromArticle.heading === toArticle.heading &&
      fromArticle.bodyMarkdown === toArticle.bodyMarkdown &&
      fromArticle.status === toArticle.status
    ) {
      status = "unchanged";
    } else {
      status = "changed";
    }

    return { articleNumber, from: fromArticle, status, to: toArticle };
  });
}

// Version history browser (#1117): pick any two versions and see a
// per-article added/removed/changed diff, with a word-level text diff on
// body_markdown for changed articles.
export function LawDocumentVersionBrowser({
  documentId,
  documentTitle,
  onClose,
}: LawDocumentVersionBrowserProps): JSX.Element {
  const versionsQuery = useQuery(lawDocumentVersionsQueryOptions(documentId));
  const versions = versionsQuery.data ?? [];

  const [fromVersion, setFromVersion] = useState<number | null>(null);
  const [toVersion, setToVersion] = useState<number | null>(null);

  const effectiveFrom =
    fromVersion ?? (versions.length > 1 ? versions[1].version : null);
  const effectiveTo =
    toVersion ?? (versions.length > 0 ? versions[0].version : null);

  const fromSnapshot =
    versions.find((version) => version.version === effectiveFrom)
      ?.articlesSnapshot ?? [];
  const toSnapshot =
    versions.find((version) => version.version === effectiveTo)
      ?.articlesSnapshot ?? [];

  // Cheap enough (a handful of articles) to recompute on every render --
  // skips the useMemo dependency-array churn from two derived arrays.
  const diffs = diffArticles(fromSnapshot, toSnapshot);

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{documentTitle}: version history</DialogTitle>
          <DialogDescription>
            Compare any two enacted versions article by article.
          </DialogDescription>
        </DialogHeader>

        {versionsQuery.isPending ? (
          <LoadingState label="Loading versions…" />
        ) : versionsQuery.isError ? (
          <ErrorState
            title="Versions could not be loaded"
            description={getErrorDescription(versionsQuery.error)}
          />
        ) : (
          <div className="grid max-h-[60vh] gap-4 overflow-y-auto pr-1">
            <div className="flex flex-wrap items-center gap-2">
              <VersionSelect
                label="From"
                onChange={setFromVersion}
                value={effectiveFrom}
                versions={versions}
              />
              <VersionSelect
                label="To"
                onChange={setToVersion}
                value={effectiveTo}
                versions={versions}
              />
            </div>

            {effectiveFrom === null || effectiveTo === null ? (
              <p className="text-sm text-muted-foreground">
                This document only has one version.
              </p>
            ) : (
              <ol className="grid gap-3">
                {diffs.map((diff) => (
                  <ArticleDiffRow key={diff.articleNumber} diff={diff} />
                ))}
              </ol>
            )}
          </div>
        )}

        <DialogFooter>
          <Button type="button" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VersionSelect({
  label,
  onChange,
  value,
  versions,
}: {
  readonly label: string;
  readonly onChange: (version: number) => void;
  readonly value: number | null;
  readonly versions: readonly {
    readonly version: number;
    readonly amendmentTitle: string;
  }[];
}): JSX.Element {
  return (
    <div className="grid gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <Select
        value={value === null ? undefined : String(value)}
        onValueChange={(next) => onChange(Number(next))}
      >
        <SelectTrigger aria-label={`${label} version`} className="w-56">
          <SelectValue placeholder="Select a version" />
        </SelectTrigger>
        <SelectContent>
          {versions.map((version) => (
            <SelectItem key={version.version} value={String(version.version)}>
              v{version.version} — {version.amendmentTitle}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ArticleDiffRow({ diff }: { readonly diff: ArticleDiff }): JSX.Element {
  const heading = diff.to?.heading ?? diff.from?.heading ?? "";

  return (
    <li className="grid gap-1 rounded-md border border-border p-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-medium">
          Article {diff.articleNumber}. {heading}
        </h3>
        <Badge variant={STATUS_BADGE_VARIANTS[diff.status]}>
          {STATUS_LABELS[diff.status]}
        </Badge>
      </div>
      {diff.status === "changed" && diff.from !== null && diff.to !== null ? (
        <TextDiff from={diff.from.bodyMarkdown} to={diff.to.bodyMarkdown} />
      ) : (
        <p className="whitespace-pre-wrap text-sm text-muted-foreground">
          {diff.to?.bodyMarkdown ?? diff.from?.bodyMarkdown ?? ""}
        </p>
      )}
    </li>
  );
}

function TextDiff({
  from,
  to,
}: {
  readonly from: string;
  readonly to: string;
}): JSX.Element {
  const parts = useMemo(() => diffWords(from, to), [from, to]);

  return (
    <p className="whitespace-pre-wrap text-sm">
      {parts.map((part, index) => {
        const key = `${index}-${part.value}`;
        if (part.added === true) {
          return (
            <span key={key} className="bg-success/20 text-success-foreground">
              {part.value}
            </span>
          );
        }
        if (part.removed === true) {
          return (
            <span
              key={key}
              className="bg-destructive/20 text-destructive line-through"
            >
              {part.value}
            </span>
          );
        }
        return (
          <span key={key} className="text-muted-foreground">
            {part.value}
          </span>
        );
      })}
    </p>
  );
}
