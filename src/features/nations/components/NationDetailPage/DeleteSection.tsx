import { useMutation, type QueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState, type JSX } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { deleteNationMutationOptions } from "../../mutations/nationsMutations";

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
        onError: (error) => {
          notifyMutationError(error, "Failed to delete nation.");
        },
        onSuccess: () => {
          setIsConfirming(false);
          notifyMutationSuccess("Nation deleted.");
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
      <ConfirmDialog
        open={isConfirming}
        onOpenChange={(open) => {
          if (!open) {
            setIsConfirming(false);
            deleteMutation.reset();
          }
        }}
        title="Delete nation"
        description={
          <>
            Are you sure you want to delete{" "}
            <span className="font-medium">{nation.name}</span>? This action
            cannot be undone.
          </>
        }
        confirmLabel={deleteMutation.isPending ? "Deleting…" : "Delete nation"}
        isPending={deleteMutation.isPending}
        onConfirm={handleConfirm}
      />
    </section>
  );
}
