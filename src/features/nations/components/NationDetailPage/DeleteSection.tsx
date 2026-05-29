import { useMutation, type QueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState, type JSX } from "react";

import { Button } from "@/components/ui/button";

import { deleteNationMutationOptions } from "../../mutations/nationsMutations";

import { getMutationErrorDescription } from "./ErrorMessages";

import type { Nation } from "../../types/nationTypes";

export function NationDeleteSection({
  nation,
  queryClient,
}: {
  readonly nation: Nation;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const navigate = useNavigate();
  const [isConfirming, setIsConfirming] = useState(false);
  const deleteMutation = useMutation(
    deleteNationMutationOptions({ queryClient }),
  );

  function handleConfirm(): void {
    deleteMutation.reset();
    deleteMutation.mutate(
      { nationId: nation.id, worldId: nation.worldId },
      {
        onSuccess: () => {
          setIsConfirming(false);
          void navigate({
            params: { worldId: nation.worldId },
            replace: true,
            to: "/worlds/$worldId/nations",
          });
        },
      },
    );
  }

  return (
    <section
      aria-labelledby="nation-delete-heading"
      className="grid gap-3 rounded-md border border-destructive/30 bg-card p-4 text-card-foreground"
    >
      <div className="space-y-1">
        <h2 id="nation-delete-heading" className="text-base font-medium">
          Danger zone
        </h2>
        <p className="text-sm text-muted-foreground">
          Permanently delete this nation. Settlements assigned to it will be
          unlinked.
        </p>
      </div>
      <div>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setIsConfirming(true)}
        >
          <Trash2 aria-hidden="true" />
          Delete nation
        </Button>
      </div>
      {isConfirming ? (
        <NationDeleteConfirmDialog
          isPending={deleteMutation.isPending}
          nationName={nation.name}
          onCancel={() => {
            setIsConfirming(false);
            deleteMutation.reset();
          }}
          onConfirm={handleConfirm}
        />
      ) : null}
      {deleteMutation.isError ? (
        <p
          role="alert"
          className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          {getMutationErrorDescription(deleteMutation.error)}
        </p>
      ) : null}
    </section>
  );
}

function NationDeleteConfirmDialog({
  isPending,
  nationName,
  onCancel,
  onConfirm,
}: {
  readonly isPending: boolean;
  readonly nationName: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4">
      <div
        aria-labelledby="nation-delete-confirm-title"
        aria-modal="true"
        className="grid w-full max-w-md gap-4 rounded-md border border-border bg-card p-5 text-card-foreground shadow-lg"
        role="dialog"
      >
        <div className="space-y-1">
          <h3
            id="nation-delete-confirm-title"
            className="text-lg font-semibold tracking-normal"
          >
            Delete nation
          </h3>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-medium">{nationName}</span>? This action
            cannot be undone.
          </p>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            disabled={isPending}
          >
            <Trash2 aria-hidden="true" />
            {isPending ? "Deleting…" : "Delete nation"}
          </Button>
        </div>
      </div>
    </div>
  );
}
