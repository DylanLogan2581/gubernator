import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type JSX } from "react";

import {
  ResourceAmountListEditor,
  type ResourceAmountEntry,
} from "@/components/shared/ResourceAmountListEditor";
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
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { depositInputLimits } from "@/lib/inputLimits";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import { sortByName } from "@/lib/sortUtils";
import { useFieldErrors } from "@/lib/zodFieldErrors";

import { createDepositInstanceMutationOptions } from "../../mutations/createDepositInstanceMutations";
import { activeDepositTypesByWorldQueryOptions } from "../../queries/depositsQueries";
import { createDepositInstanceInputSchema } from "../../schemas/createDepositInstanceSchemas";

import type { DepositType } from "../../types/depositTypes";

type AddDepositInstanceDialogProps = {
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly worldId: string;
};

export function AddDepositInstanceDialog({
  onClose,
  queryClient,
  settlementId,
  worldId,
}: AddDepositInstanceDialogProps): JSX.Element {
  const depositTypesQuery = useQuery(
    activeDepositTypesByWorldQueryOptions(worldId),
  );
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));
  const mutation = useMutation(
    createDepositInstanceMutationOptions({ queryClient }),
  );

  const depositTypes = depositTypesQuery.data ?? [];
  const resources = resourcesQuery.data ?? [];

  const [name, setName] = useState("");
  const [depositTypeId, setDepositTypeId] = useState("");
  const [maxWorkers, setMaxWorkers] = useState("");
  const [resourceEntries, setResourceEntries] = useState<ResourceAmountEntry[]>(
    [],
  );

  const { fieldErrors, setFromZod, clear } = useFieldErrors<
    "name" | "depositTypeId" | "maxWorkers" | "resources"
  >();

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    clear();

    const parsedMax = maxWorkers !== "" ? parseInt(maxWorkers, 10) : undefined;

    const input = {
      depositTypeId,
      maxWorkers: parsedMax,
      name,
      resources: resourceEntries.map((e) => ({
        initialQuantity: parseFloat(e.amount),
        resourceId: e.resourceId,
      })),
      settlementId,
    };

    const result = createDepositInstanceInputSchema.safeParse(input);
    if (!result.success) {
      setFromZod(result.error);
      return;
    }

    mutation.mutate(input, {
      onError: (error) => {
        notifyMutationError(error, "Failed to create deposit instance.");
      },
      onSuccess: () => {
        notifyMutationSuccess("Deposit instance created.");
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
      <DialogContent className="max-w-lg">
        <form className="contents" noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add deposit instance</DialogTitle>
            <DialogDescription>
              Add a deposit instance to this settlement.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Label htmlFor="add-deposit-name" className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Name</span>
              <Input
                id="add-deposit-name"
                aria-invalid={fieldErrors.name !== undefined}
                aria-label="Name"
                disabled={mutation.isPending}
                maxLength={depositInputLimits.depositInstanceNameMax}
                value={name}
                onChange={(e) => {
                  setName(e.currentTarget.value);
                }}
              />
              {fieldErrors.name !== undefined ? (
                <p className="text-xs text-destructive">{fieldErrors.name}</p>
              ) : null}
            </Label>
            <Label htmlFor="add-deposit-type" className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Deposit type</span>
              {depositTypes.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No active deposit types available.
                </p>
              ) : (
                <NativeSelect
                  id="add-deposit-type"
                  aria-invalid={fieldErrors.depositTypeId !== undefined}
                  aria-label="Deposit type"
                  className="w-full"
                  disabled={mutation.isPending}
                  value={depositTypeId}
                  onChange={(e) => {
                    setDepositTypeId(e.currentTarget.value);
                  }}
                >
                  <option value="">Select a deposit type…</option>
                  {sortByName(depositTypes).map((dt: DepositType) => (
                    <option key={dt.id} value={dt.id}>
                      {dt.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
              {fieldErrors.depositTypeId !== undefined ? (
                <p className="text-xs text-destructive">
                  {fieldErrors.depositTypeId}
                </p>
              ) : null}
            </Label>
            <Label
              htmlFor="add-deposit-maxworkers"
              className="grid gap-1 text-sm"
            >
              <span className="text-muted-foreground">
                Max workers (leave blank for unlimited)
              </span>
              <Input
                id="add-deposit-maxworkers"
                aria-invalid={fieldErrors.maxWorkers !== undefined}
                aria-label="Max workers"
                disabled={mutation.isPending}
                inputMode="numeric"
                placeholder="Unlimited"
                value={maxWorkers}
                onChange={(e) => {
                  setMaxWorkers(e.currentTarget.value);
                }}
              />
              {fieldErrors.maxWorkers !== undefined ? (
                <p className="text-xs text-destructive">
                  {fieldErrors.maxWorkers}
                </p>
              ) : null}
            </Label>
            <ResourceAmountListEditor
              addLabel="Add resource"
              amountLabel="initial quantity"
              disabled={mutation.isPending}
              entries={resourceEntries}
              fieldError={fieldErrors.resources}
              label="Resources"
              resources={resources}
              onChange={setResourceEntries}
            />
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
              Add
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
