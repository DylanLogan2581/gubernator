import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import {
  createLawDocumentMutationOptions,
  repealLawDocumentMutationOptions,
} from "../mutations/lawDocumentsMutations";
import {
  lawDocumentArticlesQueryOptions,
  nationLawDocumentsQueryOptions,
  settlementLawDocumentsQueryOptions,
} from "../queries/lawDocumentsQueries";

import { LawDocumentVersionBrowser } from "./LawDocumentVersionBrowser";

import type { LawDocument } from "../types/lawDocumentTypes";

type LawDocumentScopeContext =
  | {
      readonly scope: "nation";
      readonly nationId: string;
      readonly worldId: string;
    }
  | {
      readonly scope: "settlement";
      readonly nationId: string;
      readonly settlementId: string;
      readonly worldId: string;
    };

export type LawDocumentsSectionProps = LawDocumentScopeContext & {
  readonly canManage: boolean;
  readonly canRepeal: boolean;
  readonly isArchived: boolean;
};

// #1117: DM-reference law books for a nation or settlement's government tab.
// Every write is RPC-only (create_law_document, repeal_law_document) --
// amendment/decree procedures land in a later issue, so this section only
// supports create + direct admin repeal, plus reading the version history.
export function LawDocumentsSection(
  props: LawDocumentsSectionProps,
): JSX.Element {
  const { canManage, canRepeal, isArchived } = props;
  const queryClient = useQueryClient();

  const isNationScope = props.scope === "nation";
  const settlementId = props.scope === "settlement" ? props.settlementId : "";

  const nationDocumentsQuery = useQuery({
    ...nationLawDocumentsQueryOptions(props.nationId),
    enabled: isNationScope,
  });
  const settlementDocumentsQuery = useQuery({
    ...settlementLawDocumentsQueryOptions(settlementId),
    enabled: !isNationScope,
  });
  const documentsQuery = isNationScope
    ? nationDocumentsQuery
    : settlementDocumentsQuery;

  const repealMutation = useMutation(
    repealLawDocumentMutationOptions({ queryClient }),
  );

  const [creating, setCreating] = useState(false);
  const [viewing, setViewing] = useState<LawDocument | null>(null);
  const [repealing, setRepealing] = useState<LawDocument | null>(null);

  const documents = documentsQuery.data ?? [];

  function handleRepealConfirm(): void {
    if (repealing === null) return;
    repealMutation.mutate(
      {
        id: repealing.id,
        nationId: repealing.nationId,
        settlementId: repealing.settlementId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to repeal document.");
        },
        onSuccess: () => {
          notifyMutationSuccess(`${repealing.title} repealed.`);
          setRepealing(null);
        },
      },
    );
  }

  return (
    <>
      <Card aria-labelledby="law-documents-heading" className="grid gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 id="law-documents-heading" className="text-base font-medium">
            Documents
          </h2>
          {canManage && !isArchived ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setCreating(true)}
            >
              New document
            </Button>
          ) : null}
        </div>

        {documentsQuery.isPending ? (
          <LoadingState label="Loading documents…" />
        ) : documentsQuery.isError ? (
          <ErrorState
            title="Documents could not be loaded"
            description={getErrorDescription(documentsQuery.error)}
          />
        ) : documents.length === 0 ? (
          <EmptyState
            title="No law documents yet"
            description="Create a founding charter or bylaws to establish a book of law."
          />
        ) : (
          <ul className="grid gap-2">
            {documents.map((document) => (
              <li
                key={document.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border p-3"
              >
                <div className="grid gap-0.5">
                  <span className="font-medium">{document.title}</span>
                  <span className="text-xs text-muted-foreground">
                    Version {document.currentVersion}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      document.status === "active" ? "success" : "secondary"
                    }
                  >
                    {document.status}
                  </Badge>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setViewing(document)}
                  >
                    View
                  </Button>
                  {canRepeal && document.status === "active" && !isArchived ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setRepealing(document)}
                    >
                      Repeal
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canManage && creating ? (
        <CreateLawDocumentDialog
          onClose={() => setCreating(false)}
          queryClient={queryClient}
          scopeContext={props}
        />
      ) : null}

      {viewing !== null ? (
        <LawDocumentViewDialog
          document={viewing}
          onClose={() => setViewing(null)}
        />
      ) : null}

      <AlertDialog
        open={repealing !== null}
        onOpenChange={(open) => {
          if (!open) setRepealing(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Repeal document?</AlertDialogTitle>
            <AlertDialogDescription>
              {repealing === null
                ? ""
                : `This will mark ${repealing.title} as repealed. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel disabled={repealMutation.isPending}>
              Keep document
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRepealConfirm}
              disabled={repealMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {repealMutation.isPending ? "Repealing…" : "Repeal"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function CreateLawDocumentDialog({
  onClose,
  queryClient,
  scopeContext,
}: {
  readonly onClose: () => void;
  readonly queryClient: ReturnType<typeof useQueryClient>;
  readonly scopeContext: LawDocumentScopeContext;
}): JSX.Element {
  const [title, setTitle] = useState("");
  const [preamble, setPreamble] = useState("");
  const [articles, setArticles] = useState<
    readonly {
      readonly key: string;
      readonly heading: string;
      readonly bodyMarkdown: string;
    }[]
  >([{ key: globalThis.crypto.randomUUID(), heading: "", bodyMarkdown: "" }]);

  const createMutation = useMutation(
    createLawDocumentMutationOptions({ queryClient }),
  );

  function updateArticle(
    key: string,
    field: "heading" | "bodyMarkdown",
    value: string,
  ): void {
    setArticles(
      articles.map((article) =>
        article.key === key ? { ...article, [field]: value } : article,
      ),
    );
  }

  function addArticle(): void {
    setArticles([
      ...articles,
      { key: globalThis.crypto.randomUUID(), heading: "", bodyMarkdown: "" },
    ]);
  }

  function removeArticle(key: string): void {
    setArticles(articles.filter((article) => article.key !== key));
  }

  const trimmedTitle = title.trim();
  const validArticles = articles.filter(
    (article) =>
      article.heading.trim() !== "" && article.bodyMarkdown.trim() !== "",
  );
  const canSubmit =
    trimmedTitle !== "" &&
    validArticles.length > 0 &&
    validArticles.length === articles.length;

  function handleSubmit(): void {
    if (!canSubmit) return;

    createMutation.mutate(
      {
        articles: validArticles.map((article) => ({
          bodyMarkdown: article.bodyMarkdown,
          heading: article.heading,
        })),
        nationId:
          scopeContext.scope === "nation" ? scopeContext.nationId : null,
        preambleMarkdown: preamble,
        settlementId:
          scopeContext.scope === "settlement"
            ? scopeContext.settlementId
            : null,
        title: trimmedTitle,
        worldId: scopeContext.worldId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to create document.");
        },
        onSuccess: () => {
          notifyMutationSuccess(`${trimmedTitle} created.`);
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>New document</DialogTitle>
          <DialogDescription>
            Version 1 is snapshotted immediately on creation.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-3 overflow-y-auto pr-1">
          <div className="grid gap-1">
            <Label htmlFor="law-document-title">Title</Label>
            <Input
              id="law-document-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="The Founding Charter"
            />
          </div>
          <div className="grid gap-1">
            <Label htmlFor="law-document-preamble">Preamble (optional)</Label>
            <Textarea
              id="law-document-preamble"
              value={preamble}
              onChange={(e) => setPreamble(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid gap-2 border-t border-border pt-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Articles</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addArticle}
              >
                Add article
              </Button>
            </div>
            <ul className="grid gap-2">
              {articles.map((article, index) => (
                <li
                  key={article.key}
                  className="grid gap-2 rounded-md border border-border p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <Label className="text-xs text-muted-foreground">
                      Article {index + 1}
                    </Label>
                    {articles.length > 1 ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => removeArticle(article.key)}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                  <Input
                    value={article.heading}
                    onChange={(e) =>
                      updateArticle(article.key, "heading", e.target.value)
                    }
                    placeholder="Heading"
                  />
                  <Textarea
                    value={article.bodyMarkdown}
                    onChange={(e) =>
                      updateArticle(article.key, "bodyMarkdown", e.target.value)
                    }
                    placeholder="Body"
                    rows={3}
                  />
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || createMutation.isPending}
          >
            {createMutation.isPending ? "Creating…" : "Create document"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LawDocumentViewDialog({
  document,
  onClose,
}: {
  readonly document: LawDocument;
  readonly onClose: () => void;
}): JSX.Element {
  const [browsingVersions, setBrowsingVersions] = useState(false);
  const articlesQuery = useQuery(lawDocumentArticlesQueryOptions(document.id));

  const activeArticles = (articlesQuery.data ?? []).filter(
    (article) => article.status === "active",
  );

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{document.title}</DialogTitle>
            <DialogDescription>
              Version {document.currentVersion} · {document.status}
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[60vh] gap-4 overflow-y-auto pr-1">
            {document.preambleMarkdown !== null ? (
              <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                {document.preambleMarkdown}
              </p>
            ) : null}

            {articlesQuery.isPending ? (
              <LoadingState label="Loading articles…" />
            ) : articlesQuery.isError ? (
              <ErrorState
                title="Articles could not be loaded"
                description={getErrorDescription(articlesQuery.error)}
              />
            ) : activeArticles.length === 0 ? (
              <EmptyState
                title="No active articles"
                description="Every article of this document has been repealed."
              />
            ) : (
              <ol className="grid gap-3">
                {activeArticles.map((article) => (
                  <li key={article.articleNumber} className="grid gap-1">
                    <h3 className="text-sm font-medium">
                      Article {article.articleNumber}. {article.heading}
                    </h3>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                      {article.bodyMarkdown}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setBrowsingVersions(true)}
            >
              Version history
            </Button>
            <Button type="button" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {browsingVersions ? (
        <LawDocumentVersionBrowser
          documentId={document.id}
          documentTitle={document.title}
          onClose={() => setBrowsingVersions(false)}
        />
      ) : null}
    </>
  );
}
