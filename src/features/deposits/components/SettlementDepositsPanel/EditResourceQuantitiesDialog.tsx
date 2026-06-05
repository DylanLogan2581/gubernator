import { useMutation, type QueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { setDepositInstanceResourceQuantitiesMutationOptions } from "../../mutations/setDepositInstanceResourceQuantitiesMutations";

import type {
  DepositInstance,
  DepositInstanceResource,
} from "../../types/depositInstanceTypes";

type ResourceFormState = {
  readonly depositInstanceResourceId: string;
  readonly resourceName: string;
  initialQuantity: string;
  remainingQuantity: string;
  fieldError: string | undefined;
};

function buildInitialState(
  resources: readonly DepositInstanceResource[],
): ResourceFormState[] {
  return resources.map((r) => ({
    depositInstanceResourceId: r.id,
    resourceName: r.resourceName,
    initialQuantity: String(r.initialQuantity),
    remainingQuantity: String(r.remainingQuantity),
    fieldError: undefined,
  }));
}

type EditResourceQuantitiesDialogProps = {
  readonly instance: DepositInstance;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
};

export function EditResourceQuantitiesDialog({
  instance,
  onClose,
  queryClient,
  settlementId,
}: EditResourceQuantitiesDialogProps): JSX.Element {
  const [rows, setRows] = useState<ResourceFormState[]>(() =>
    buildInitialState(instance.resources),
  );

  const mutation = useMutation(
    setDepositInstanceResourceQuantitiesMutationOptions({ queryClient }),
  );

  function updateRow(
    index: number,
    patch: Partial<
      Pick<ResourceFormState, "initialQuantity" | "remainingQuantity">
    >,
  ): void {
    setRows((prev) =>
      prev.map((r, i) =>
        i === index ? { ...r, ...patch, fieldError: undefined } : r,
      ),
    );
  }

  function validateRow(row: ResourceFormState): string | undefined {
    const initial = parseFloat(row.initialQuantity);
    const remaining = parseFloat(row.remainingQuantity);

    if (
      row.initialQuantity === "" ||
      Number.isNaN(initial) ||
      !Number.isFinite(initial)
    ) {
      return "Initial quantity must be a valid number.";
    }
    if (initial < 0) {
      return "Initial quantity must be >= 0.";
    }
    if (
      row.remainingQuantity === "" ||
      Number.isNaN(remaining) ||
      !Number.isFinite(remaining)
    ) {
      return "Remaining quantity must be a valid number.";
    }
    if (remaining < 0) {
      return "Remaining quantity must be >= 0.";
    }
    if (remaining > initial) {
      return "Remaining quantity must be <= initial quantity.";
    }
    return undefined;
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();

    const validated = rows.map((row) => {
      const error = validateRow(row);
      return { ...row, fieldError: error };
    });

    if (validated.some((r) => r.fieldError !== undefined)) {
      setRows(validated);
      return;
    }

    try {
      for (const row of validated) {
        await mutation.mutateAsync({
          depositInstanceResourceId: row.depositInstanceResourceId,
          initialQuantity: parseFloat(row.initialQuantity),
          remainingQuantity: parseFloat(row.remainingQuantity),
          settlementId,
        });
      }
      notifyMutationSuccess("Resource quantities updated.");
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to update resource quantities.");
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <form
          className="contents"
          noValidate
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
        >
          <DialogHeader>
            <DialogTitle>
              Edit resource quantities — {instance.name}
            </DialogTitle>
            <DialogDescription>
              Set the total and remaining amounts for each resource. Remaining
              must be between 0 and the initial total.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            {rows.map((row, index) => (
              <fieldset
                key={row.depositInstanceResourceId}
                className="grid gap-2"
              >
                <legend className="text-sm font-medium">
                  {row.resourceName}
                </legend>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-1 text-sm">
                    <span className="text-muted-foreground">
                      Total (initial)
                    </span>
                    <Input
                      aria-invalid={row.fieldError !== undefined}
                      aria-label={`Initial quantity for ${row.resourceName}`}
                      disabled={mutation.isPending}
                      inputMode="decimal"
                      value={row.initialQuantity}
                      onChange={(e) => {
                        updateRow(index, {
                          initialQuantity: e.currentTarget.value,
                        });
                      }}
                    />
                  </label>
                  <label className="grid gap-1 text-sm">
                    <span className="text-muted-foreground">Remaining</span>
                    <Input
                      aria-invalid={row.fieldError !== undefined}
                      aria-label={`Remaining quantity for ${row.resourceName}`}
                      disabled={mutation.isPending}
                      inputMode="decimal"
                      value={row.remainingQuantity}
                      onChange={(e) => {
                        updateRow(index, {
                          remainingQuantity: e.currentTarget.value,
                        });
                      }}
                    />
                  </label>
                </div>
                {row.fieldError !== undefined ? (
                  <p className="text-xs text-destructive">{row.fieldError}</p>
                ) : null}
              </fieldset>
            ))}
          </div>
          <DialogFooter>
            <Button
              disabled={mutation.isPending}
              onClick={onClose}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={mutation.isPending} type="submit">
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
