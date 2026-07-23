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
import { useFieldErrors } from "@/lib/zodFieldErrors";

import { transferManagedPopulationCountMutationOptions } from "../../mutations/transferManagedPopulationCountMutations";
import { transferManagedPopulationCountInputSchema } from "../../schemas/transferManagedPopulationCountSchemas";

import type { ManagedPopulationInstance } from "../../types/managedPopulationInstanceTypes";

type TransferManagedPopulationCountDialogProps = {
  readonly instance: ManagedPopulationInstance;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly targets: readonly ManagedPopulationInstance[];
};

export function TransferManagedPopulationCountDialog({
  instance,
  onClose,
  queryClient,
  targets,
}: TransferManagedPopulationCountDialogProps): JSX.Element {
  const mutation = useMutation(
    transferManagedPopulationCountMutationOptions({ queryClient }),
  );

  const [targetId, setTargetId] = useState(targets[0]?.id ?? "");
  const [count, setCount] = useState("");

  const { fieldErrors, setFromZod, clear } = useFieldErrors<
    "toManagedPopulationInstanceId" | "count"
  >();

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    clear();

    const parsedCount = parseFloat(count);

    const input = {
      count: parsedCount,
      fromManagedPopulationInstanceId: instance.id,
      toManagedPopulationInstanceId: targetId,
    };

    const result = transferManagedPopulationCountInputSchema
      .refine((v) => v.count <= instance.currentCount, {
        message: `Count cannot exceed current count (${instance.currentCount.toLocaleString()}).`,
        path: ["count"],
      })
      .safeParse(input);
    if (!result.success) {
      setFromZod(result.error);
      return;
    }

    mutation.mutate(input, {
      onError: (error) => {
        notifyMutationError(error, "Failed to transfer headcount.");
      },
      onSuccess: () => {
        notifyMutationSuccess("Headcount transferred.");
        onClose();
      },
    });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <form className="contents" noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Transfer headcount</DialogTitle>
            <DialogDescription>
              Move headcount from {instance.name} to another instance of the
              same type.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Label className="grid gap-1 text-sm" htmlFor="transfer-target">
              <span className="text-muted-foreground">Target instance</span>
              <NativeSelect
                aria-invalid={
                  fieldErrors.toManagedPopulationInstanceId !== undefined
                }
                aria-label="Target instance"
                className="w-full"
                disabled={mutation.isPending}
                id="transfer-target"
                value={targetId}
                onChange={(e) => {
                  setTargetId(e.currentTarget.value);
                }}
              >
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </NativeSelect>
              {fieldErrors.toManagedPopulationInstanceId !== undefined ? (
                <p className="text-xs text-destructive">
                  {fieldErrors.toManagedPopulationInstanceId}
                </p>
              ) : null}
            </Label>
            <Label className="grid gap-1 text-sm" htmlFor="transfer-count">
              <span className="text-muted-foreground">
                Count (max {instance.currentCount.toLocaleString()})
              </span>
              <Input
                aria-invalid={fieldErrors.count !== undefined}
                aria-label="Count"
                disabled={mutation.isPending}
                id="transfer-count"
                inputMode="numeric"
                max={instance.currentCount}
                min={1}
                type="number"
                value={count}
                onChange={(e) => {
                  setCount(e.currentTarget.value);
                }}
              />
              {fieldErrors.count !== undefined ? (
                <p className="text-xs text-destructive">{fieldErrors.count}</p>
              ) : null}
            </Label>
          </div>
          <DialogFooter>
            <Button
              disabled={mutation.isPending}
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button disabled={mutation.isPending} type="submit">
              Transfer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
