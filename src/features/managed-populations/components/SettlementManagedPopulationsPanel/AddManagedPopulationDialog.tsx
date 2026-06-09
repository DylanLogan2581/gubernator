import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
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
import { managedPopulationInputLimits } from "@/lib/inputLimits";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import { sortByName } from "@/lib/sortUtils";

import { createManagedPopulationInstanceMutationOptions } from "../../mutations/createManagedPopulationInstanceMutations";
import { activeManagedPopulationTypesByWorldQueryOptions } from "../../queries/managedPopulationsQueries";
import { createManagedPopulationInstanceInputSchema } from "../../schemas/createManagedPopulationInstanceSchemas";

import type { ManagedPopulationType } from "../../types/managedPopulationTypes";

type AddManagedPopulationDialogProps = {
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly worldId: string;
};

export function AddManagedPopulationDialog({
  onClose,
  queryClient,
  settlementId,
  worldId,
}: AddManagedPopulationDialogProps): JSX.Element {
  const typesQuery = useQuery(
    activeManagedPopulationTypesByWorldQueryOptions(worldId),
  );
  const mutation = useMutation(
    createManagedPopulationInstanceMutationOptions({ queryClient }),
  );

  const types = typesQuery.data ?? [];

  const [name, setName] = useState("");
  const [typeId, setTypeId] = useState("");
  const [initialCount, setInitialCount] = useState("");
  const [initialCullQuantity, setInitialCullQuantity] = useState("0");

  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [typeError, setTypeError] = useState<string | undefined>(undefined);
  const [initialCountError, setInitialCountError] = useState<
    string | undefined
  >(undefined);
  const [initialCullError, setInitialCullError] = useState<string | undefined>(
    undefined,
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setNameError(undefined);
    setTypeError(undefined);
    setInitialCountError(undefined);
    setInitialCullError(undefined);

    const parsedCount = parseFloat(initialCount);
    const parsedCull = parseFloat(initialCullQuantity);

    const input = {
      initialCount: parsedCount,
      initialCullQuantity: parsedCull,
      name,
      settlementId,
      typeId,
    };

    const result = createManagedPopulationInstanceInputSchema.safeParse(input);
    if (!result.success) {
      const errors: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const field = String(issue.path[0]);
        if (!(field in errors)) {
          errors[field] = issue.message;
        }
      }
      if (errors.name !== undefined) setNameError(errors.name);
      if (errors.typeId !== undefined) setTypeError(errors.typeId);
      if (errors.initialCount !== undefined)
        setInitialCountError(errors.initialCount);
      if (errors.initialCullQuantity !== undefined)
        setInitialCullError(errors.initialCullQuantity);
      return;
    }

    mutation.mutate(input, {
      onError: (error) => {
        notifyMutationError(error, "Failed to create managed population.");
      },
      onSuccess: () => {
        notifyMutationSuccess("Managed population created.");
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
            <DialogTitle>Add managed population</DialogTitle>
            <DialogDescription className="sr-only">
              Add a managed population instance to this settlement.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Label className="grid gap-1 text-sm" htmlFor="add-pop-name">
              <span className="text-muted-foreground">Name</span>
              <Input
                aria-invalid={nameError !== undefined}
                aria-label="Name"
                disabled={mutation.isPending}
                id="add-pop-name"
                maxLength={
                  managedPopulationInputLimits.populationInstanceNameMax
                }
                value={name}
                onChange={(e) => {
                  setName(e.currentTarget.value);
                }}
              />
              {nameError !== undefined ? (
                <p className="text-xs text-destructive">{nameError}</p>
              ) : null}
            </Label>
            <Label className="grid gap-1 text-sm" htmlFor="add-pop-type">
              <span className="text-muted-foreground">Population type</span>
              {types.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No active population types available.
                </p>
              ) : (
                <NativeSelect
                  aria-invalid={typeError !== undefined}
                  aria-label="Population type"
                  className="w-full"
                  disabled={mutation.isPending}
                  id="add-pop-type"
                  value={typeId}
                  onChange={(e) => {
                    setTypeId(e.currentTarget.value);
                  }}
                >
                  <option value="">Select a population type…</option>
                  {sortByName(types).map((t: ManagedPopulationType) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
              {typeError !== undefined ? (
                <p className="text-xs text-destructive">{typeError}</p>
              ) : null}
            </Label>
            <Label className="grid gap-1 text-sm" htmlFor="add-pop-count">
              <span className="text-muted-foreground">Initial count</span>
              <Input
                aria-invalid={initialCountError !== undefined}
                aria-label="Initial count"
                disabled={mutation.isPending}
                id="add-pop-count"
                inputMode="numeric"
                min={1}
                type="number"
                value={initialCount}
                onChange={(e) => {
                  setInitialCount(e.currentTarget.value);
                }}
              />
              {initialCountError !== undefined ? (
                <p className="text-xs text-destructive">{initialCountError}</p>
              ) : null}
            </Label>
            <Label className="grid gap-1 text-sm" htmlFor="add-pop-cull">
              <span className="text-muted-foreground">
                Initial cull quantity
              </span>
              <Input
                aria-invalid={initialCullError !== undefined}
                aria-label="Initial cull quantity"
                disabled={mutation.isPending}
                id="add-pop-cull"
                inputMode="numeric"
                min={0}
                type="number"
                value={initialCullQuantity}
                onChange={(e) => {
                  setInitialCullQuantity(e.currentTarget.value);
                }}
              />
              {initialCullError !== undefined ? (
                <p className="text-xs text-destructive">{initialCullError}</p>
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
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
