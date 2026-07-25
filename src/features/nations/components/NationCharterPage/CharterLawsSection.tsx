import { useQuery } from "@tanstack/react-query";
import { Scroll } from "lucide-react";
import { useState, type JSX, type ReactNode } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Button } from "@/components/ui/button";
import {
  lawDocumentArticlesQueryOptions,
  LawDocumentVersionBrowser,
  nationLawDocumentsQueryOptions,
} from "@/features/law-documents";
import type { LawDocument } from "@/features/law-documents";
import { getErrorDescription } from "@/lib/errorUtils";

export function CharterLawsSection({
  nationId,
}: {
  readonly nationId: string;
}): JSX.Element {
  const [viewingHistoryFor, setViewingHistoryFor] =
    useState<LawDocument | null>(null);
  const documentsQuery = useQuery(nationLawDocumentsQueryOptions(nationId));

  if (documentsQuery.isPending) {
    return (
      <Frame>
        <LoadingState label="Loading laws…" />
      </Frame>
    );
  }

  if (documentsQuery.isError) {
    return (
      <Frame>
        <ErrorState
          title="Laws could not be loaded"
          description={getErrorDescription(documentsQuery.error)}
        />
      </Frame>
    );
  }

  const activeDocuments = documentsQuery.data.filter(
    (document) => document.status === "active",
  );

  if (activeDocuments.length === 0) {
    return (
      <Frame>
        <EmptyState
          title="No active documents"
          description="This nation has not enacted any laws."
        />
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="divide-y divide-border border-y border-border">
        {activeDocuments.map((document) => (
          <LawDocumentEntry
            key={document.id}
            document={document}
            onViewHistory={() => {
              setViewingHistoryFor(document);
            }}
          />
        ))}
      </div>
      {viewingHistoryFor !== null ? (
        <LawDocumentVersionBrowser
          documentId={viewingHistoryFor.id}
          documentTitle={viewingHistoryFor.title}
          onClose={() => {
            setViewingHistoryFor(null);
          }}
        />
      ) : null}
    </Frame>
  );
}

function LawDocumentEntry({
  document,
  onViewHistory,
}: {
  readonly document: LawDocument;
  readonly onViewHistory: () => void;
}): JSX.Element {
  const articlesQuery = useQuery(lawDocumentArticlesQueryOptions(document.id));
  const activeArticles = (articlesQuery.data ?? [])
    .filter((article) => article.status === "active")
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <details open className="group">
      <summary className="cursor-pointer list-none py-3 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold">{document.title}</h3>
          <span
            aria-hidden="true"
            className="text-xs text-muted-foreground transition-transform group-open:rotate-180"
          >
            ▾
          </span>
        </div>
      </summary>
      <div className="grid gap-3 pb-3">
        {document.preambleMarkdown !== null &&
        document.preambleMarkdown !== "" ? (
          <p className="whitespace-pre-wrap text-sm italic text-muted-foreground">
            {document.preambleMarkdown}
          </p>
        ) : null}
        {articlesQuery.isPending ? (
          <p className="text-sm text-muted-foreground">Loading articles…</p>
        ) : articlesQuery.isError ? (
          <ErrorState
            title="Articles could not be loaded"
            description={getErrorDescription(articlesQuery.error)}
          />
        ) : activeArticles.length === 0 ? (
          <p className="text-sm italic text-muted-foreground">
            No active articles.
          </p>
        ) : (
          <ol className="grid gap-2">
            {activeArticles.map((article) => (
              <li key={article.id}>
                <p className="text-sm font-medium">
                  Article {article.articleNumber}. {article.heading}
                </p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                  {article.bodyMarkdown}
                </p>
              </li>
            ))}
          </ol>
        )}
        <Button
          className="w-fit print:hidden"
          onClick={onViewHistory}
          size="sm"
          variant="outline"
        >
          View version history
        </Button>
      </div>
    </details>
  );
}

function Frame({ children }: { readonly children: ReactNode }): JSX.Element {
  return (
    <section
      className="grid gap-3"
      aria-labelledby="nation-charter-laws-heading"
    >
      <div className="flex items-center gap-2">
        <Scroll aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 id="nation-charter-laws-heading" className="text-base font-medium">
          Laws
        </h2>
      </div>
      {children}
    </section>
  );
}
