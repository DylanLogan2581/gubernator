import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type JSX } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { GovernmentBody } from "@/features/government-bodies";
import { lawDocumentArticlesQueryOptions } from "@/features/law-documents";
import type { OfficeType } from "@/features/nations";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import type { AmendmentProcedure } from "@/shared/government";

import { proposeLawAmendmentMutationOptions } from "../mutations/lawAmendmentsMutations";
import { buildAmendmentOperations } from "../utils/buildAmendmentOperations";

import { OperationEditor } from "./OperationEditor";

import type { OperationDraft } from "../utils/buildAmendmentOperations";

const BASIC_OPERATION_KINDS = [
  "add_article",
  "amend_article",
  "repeal_article",
] as const;
type BasicOperationKind = (typeof BASIC_OPERATION_KINDS)[number];

const BASIC_OPERATION_LABELS: Readonly<Record<BasicOperationKind, string>> = {
  add_article: "Add article",
  amend_article: "Amend article",
  repeal_article: "Repeal article",
};

function defaultDraftForKind(
  kind: BasicOperationKind,
  firstArticleId: string | undefined,
): OperationDraft {
  const key = globalThis.crypto.randomUUID();
  switch (kind) {
    case "add_article":
      return {
        key,
        op: "add_article",
        heading: "",
        bodyMarkdown: "",
        position: null,
      };
    case "amend_article":
      return {
        key,
        op: "amend_article",
        articleId: firstArticleId ?? "",
        heading: "",
        bodyMarkdown: "",
      };
    case "repeal_article":
      return { key, op: "repeal_article", articleId: firstArticleId ?? "" };
  }
}

function defaultSetProcedureDraft(): OperationDraft {
  const procedure: AmendmentProcedure = { kind: "decree", authority: "ruler" };
  return {
    key: globalThis.crypto.randomUUID(),
    op: "set_procedure",
    procedure,
  };
}

// The composer (#1120): title + rationale + a repeatable multi-operation
// builder (omnibus amendments). The underlying propose_law_amendment RPC
// call is identical for decree and vote/locked procedures -- only the
// trigger label and whether a confirm step precedes the submit differ
// client-side, since the server always decides instant-apply vs. queued
// vote based on the document's current procedure.
export function ProposeAmendmentDialog({
  bodies,
  documentId,
  isDecree,
  officeTypes,
  onClose,
  proposingCitizenId,
}: {
  readonly bodies: readonly GovernmentBody[];
  readonly documentId: string;
  readonly isDecree: boolean;
  readonly officeTypes: readonly OfficeType[];
  readonly onClose: () => void;
  readonly proposingCitizenId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const articlesQuery = useQuery(lawDocumentArticlesQueryOptions(documentId));
  const activeArticles = (articlesQuery.data ?? []).filter(
    (article) => article.status === "active",
  );

  const [title, setTitle] = useState("");
  const [rationale, setRationale] = useState("");
  const [operations, setOperations] = useState<readonly OperationDraft[]>([]);
  const [newOperationKind, setNewOperationKind] =
    useState<BasicOperationKind>("add_article");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [confirmingDecree, setConfirmingDecree] = useState(false);

  const proposeMutation = useMutation(
    proposeLawAmendmentMutationOptions({ queryClient }),
  );

  function addOperation(): void {
    setOperations([
      ...operations,
      defaultDraftForKind(newOperationKind, activeArticles[0]?.id),
    ]);
  }

  function addProcedureOperation(): void {
    setOperations([...operations, defaultSetProcedureDraft()]);
  }

  function updateOperation(key: string, draft: OperationDraft): void {
    setOperations(operations.map((op) => (op.key === key ? draft : op)));
  }

  function removeOperation(key: string): void {
    setOperations(operations.filter((op) => op.key !== key));
  }

  const trimmedTitle = title.trim();
  const canSubmit = trimmedTitle !== "" && operations.length > 0;

  function submit(): void {
    if (!canSubmit) return;

    proposeMutation.mutate(
      {
        documentId,
        operations: [...buildAmendmentOperations(operations)],
        proposingCitizenId,
        rationaleMarkdown: rationale.trim() === "" ? null : rationale.trim(),
        title: trimmedTitle,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to propose amendment.");
        },
        onSuccess: (result) => {
          notifyMutationSuccess(
            result.status === "passed"
              ? `${trimmedTitle} signed into law.`
              : `${trimmedTitle} proposed.`,
          );
          setConfirmingDecree(false);
          onClose();
        },
      },
    );
  }

  function handleSubmitClick(): void {
    if (isDecree) {
      setConfirmingDecree(true);
      return;
    }
    submit();
  }

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {isDecree ? "Sign decree" : "Propose amendment"}
            </DialogTitle>
            <DialogDescription>
              {isDecree
                ? "This document's procedure is decree -- signing applies your changes immediately."
                : "An omnibus amendment can bundle multiple operations. Add at least one below."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[65vh] gap-3 overflow-y-auto pr-1">
            <div className="grid gap-1">
              <Label htmlFor="amendment-title">Title</Label>
              <Input
                id="amendment-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Of Trade and Tariffs"
              />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="amendment-rationale">Rationale (optional)</Label>
              <Textarea
                id="amendment-rationale"
                value={rationale}
                onChange={(e) => setRationale(e.target.value)}
                rows={3}
              />
            </div>

            <div className="grid gap-2 border-t border-border pt-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-medium">Operations</h3>
                <div className="flex items-center gap-2">
                  <Select
                    value={newOperationKind}
                    onValueChange={(value) =>
                      setNewOperationKind(value as BasicOperationKind)
                    }
                  >
                    <SelectTrigger
                      aria-label="New operation kind"
                      className="w-48"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BASIC_OPERATION_KINDS.map((kind) => (
                        <SelectItem key={kind} value={kind}>
                          {BASIC_OPERATION_LABELS[kind]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addOperation}
                  >
                    Add operation
                  </Button>
                </div>
              </div>

              {operations.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Add at least one operation.
                </p>
              ) : (
                <ul className="grid gap-2">
                  {operations.map((draft) => (
                    <OperationEditor
                      key={draft.key}
                      articles={activeArticles}
                      bodies={bodies}
                      draft={draft}
                      officeTypes={officeTypes}
                      onChange={(next) => updateOperation(draft.key, next)}
                      onRemove={() => removeOperation(draft.key)}
                    />
                  ))}
                </ul>
              )}
            </div>

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  {advancedOpen
                    ? "Hide advanced"
                    : "Advanced: change procedure"}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="grid gap-2 pt-2">
                <p className="text-xs text-muted-foreground">
                  Adds a set_procedure operation that replaces this document's
                  amendment procedure when this amendment is applied.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addProcedureOperation}
                  className="w-fit"
                >
                  Add procedure change
                </Button>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSubmitClick}
              disabled={!canSubmit || proposeMutation.isPending}
            >
              {proposeMutation.isPending
                ? "Submitting…"
                : isDecree
                  ? "Sign decree"
                  : "Propose amendment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmingDecree}
        onOpenChange={(open) => {
          if (!open) setConfirmingDecree(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign this decree?</AlertDialogTitle>
            <AlertDialogDescription>
              This will apply immediately -- there is no vote to bypass.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-2">
            <AlertDialogCancel disabled={proposeMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={submit}
              disabled={proposeMutation.isPending}
            >
              {proposeMutation.isPending ? "Signing…" : "Sign decree"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
