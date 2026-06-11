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
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { setDepositInstanceMaxWorkersMutationOptions } from "../../mutations/setDepositInstanceMaxWorkersMutations";

import type { DepositInstance } from "../../types/depositInstanceTypes";

type MaxWorkersEditDialogProps = {
  readonly assignedCount: number;
  readonly instance: DepositInstance;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
};

export function MaxWorkersEditDialog({
  assignedCount,
  instance,
  onClose,
  queryClient,
  settlementId,
}: MaxWorkersEditDialogProps): JSX.Element {
  const [maxWorkers, setMaxWorkers] = useState(
    instance.maxWorkers !== null ? String(instance.maxWorkers) : "",
  );
  const [fieldError, setFieldError] = useState<string | undefined>(undefined);
  const [showShrinkConfirm, setShowShrinkConfirm] = useState(false);
  const [pendingStrategy, setPendingStrategy] = useState<
    "npc_first" | "random"
  >("npc_first");

  const mutation = useMutation(
    setDepositInstanceMaxWorkersMutationOptions({ queryClient }),
  );

  const parsedMax = maxWorkers !== "" ? parseInt(maxWorkers, 10) : null;
  const cascadeCount =
    parsedMax !== null && !Number.isNaN(parsedMax) && parsedMax < assignedCount
      ? assignedCount - parsedMax
      : 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFieldError(undefined);

    if (
      maxWorkers !== "" &&
      (Number.isNaN(parsedMax) || (parsedMax !== null && parsedMax < 1))
    ) {
      setFieldError("Max workers must be at least 1.");
      return;
    }

    const newMax = maxWorkers !== "" ? parsedMax : null;

    if (newMax !== null && newMax < assignedCount) {
      setShowShrinkConfirm(true);
      return;
    }

    void submitMaxWorkers(newMax, null);
  }

  async function submitMaxWorkers(
    newMax: number | null,
    strategy: "npc_first" | "random" | null,
  ): Promise<void> {
    try {
      const result = await mutation.mutateAsync({
        depositInstanceId: instance.id,
        maxWorkers: newMax,
        removalStrategy: strategy,
        settlementId,
      });
      const count = result.unassignedCitizenIds.length;
      if (count > 0) {
        notifyMutationSuccess(
          `Max workers updated. ${count.toString()} ${count === 1 ? "citizen was" : "citizens were"} unassigned.`,
        );
      } else {
        notifyMutationSuccess("Max workers updated.");
      }
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to update max workers.");
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
        {showShrinkConfirm ? (
          <>
            <DialogHeader>
              <DialogTitle>Unassign workers?</DialogTitle>
              <DialogDescription>
                Reducing max workers to{" "}
                <span className="font-medium text-foreground">
                  {String(parsedMax)}
                </span>{" "}
                will cascade-unassign{" "}
                <span className="font-medium text-foreground">
                  {String(cascadeCount)}
                </span>{" "}
                {cascadeCount === 1 ? "citizen" : "citizens"}.
              </DialogDescription>
            </DialogHeader>
            <Label htmlFor="removal-strategy" className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Removal strategy</span>
              <NativeSelect
                id="removal-strategy"
                aria-label="Removal strategy"
                className="w-full"
                disabled={mutation.isPending}
                value={pendingStrategy}
                onChange={(e) => {
                  const val = e.currentTarget.value;
                  if (val === "npc_first" || val === "random") {
                    setPendingStrategy(val);
                  }
                }}
              >
                <option value="npc_first">NPC first</option>
                <option value="random">Random</option>
              </NativeSelect>
            </Label>
            <DialogFooter>
              <Button
                disabled={mutation.isPending}
                onClick={onClose}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={mutation.isPending}
                type="button"
                variant="destructive"
                onClick={() => {
                  void submitMaxWorkers(parsedMax, pendingStrategy);
                }}
              >
                Confirm
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form className="contents" noValidate onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>Edit max workers — {instance.name}</DialogTitle>
              <DialogDescription>
                Set the maximum number of citizens that can work this deposit.
              </DialogDescription>
            </DialogHeader>
            <Label htmlFor="edit-maxworkers" className="grid gap-1 text-sm">
              <span className="text-muted-foreground">
                Max workers (leave blank for unlimited)
              </span>
              <Input
                id="edit-maxworkers"
                aria-invalid={fieldError !== undefined}
                aria-label="Max workers"
                disabled={mutation.isPending}
                inputMode="numeric"
                placeholder="Unlimited"
                value={maxWorkers}
                onChange={(e) => {
                  setMaxWorkers(e.currentTarget.value);
                }}
              />
              {fieldError !== undefined ? (
                <p className="text-xs text-destructive">{fieldError}</p>
              ) : null}
            </Label>
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
        )}
      </DialogContent>
    </Dialog>
  );
}
