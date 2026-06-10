import { useMutation, type QueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState, type JSX } from "react";

import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { deleteSettlementMutationOptions } from "../../mutations/settlementsMutations";

import type { SettlementWithNation } from "../../types/settlementTypes";

export function SettlementDeleteSection({
  queryClient,
  settlement,
  worldId,
}: {
  readonly queryClient: QueryClient;
  readonly settlement: SettlementWithNation;
  readonly worldId: string;
}): JSX.Element {
  const navigate = useNavigate();
  const [isConfirming, setIsConfirming] = useState(false);
  const deleteMutation = useMutation(
    deleteSettlementMutationOptions({ queryClient }),
  );

  function handleConfirm(): void {
    deleteMutation.reset();
    deleteMutation.mutate(
      {
        nationId: settlement.nationId,
        settlementId: settlement.id,
        worldId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to delete settlement.");
        },
        onSuccess: () => {
          setIsConfirming(false);
          notifyMutationSuccess("Settlement deleted.");
          void navigate({
            params: { nationId: settlement.nationId, worldId },
            replace: true,
            to: "/worlds/$worldId/nations/$nationId",
          });
        },
      },
    );
  }

  return (
    <section
      aria-labelledby="settlement-delete-heading"
      className="grid gap-3 rounded-md border border-destructive/30 bg-card p-4 text-card-foreground"
    >
      <div className="space-y-1">
        <h2 id="settlement-delete-heading" className="text-base font-medium">
          Danger zone
        </h2>
        <p className="text-sm text-muted-foreground">
          Permanently delete this settlement. Citizens and other linked records
          will be removed.
        </p>
      </div>
      <div>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setIsConfirming(true)}
        >
          <Trash2 aria-hidden="true" />
          Delete settlement
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
        title="Delete settlement"
        description={
          <>
            Are you sure you want to delete{" "}
            <span className="font-medium">{settlement.name}</span>? This action
            cannot be undone.
          </>
        }
        confirmLabel={
          deleteMutation.isPending ? "Deleting…" : "Delete settlement"
        }
        isPending={deleteMutation.isPending}
        onConfirm={handleConfirm}
      />
    </section>
  );
}
