import { useMutation, type QueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState, type JSX } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { notifyMutationSuccess } from "@/lib/notify";

import { deleteSettlementMutationOptions } from "../../mutations/settlementsMutations";

import { getMutationErrorDescription } from "./ErrorMessages";

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
          toast.error(getMutationErrorDescription(error));
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
      {isConfirming ? (
        <SettlementDeleteConfirmDialog
          isPending={deleteMutation.isPending}
          settlementName={settlement.name}
          onCancel={() => {
            setIsConfirming(false);
            deleteMutation.reset();
          }}
          onConfirm={handleConfirm}
        />
      ) : null}
    </section>
  );
}

function SettlementDeleteConfirmDialog({
  isPending,
  settlementName,
  onCancel,
  onConfirm,
}: {
  readonly isPending: boolean;
  readonly settlementName: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4">
      <div
        aria-labelledby="settlement-delete-confirm-title"
        aria-modal="true"
        className="grid w-full max-w-md gap-4 rounded-md border border-border bg-card p-5 text-card-foreground shadow-lg"
        role="dialog"
      >
        <div className="space-y-1">
          <h3
            id="settlement-delete-confirm-title"
            className="text-lg font-semibold tracking-normal"
          >
            Delete settlement
          </h3>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete{" "}
            <span className="font-medium">{settlementName}</span>? This action
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
            {isPending ? "Deleting…" : "Delete settlement"}
          </Button>
        </div>
      </div>
    </div>
  );
}
