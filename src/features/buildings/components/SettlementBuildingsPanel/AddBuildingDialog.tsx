import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { useId, useState, type JSX } from "react";

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
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { addSettlementBuildingMutationOptions } from "../../mutations/addSettlementBuildingMutations";
import {
  blueprintsByWorldQueryOptions,
  tiersByBlueprintQueryOptions,
} from "../../queries/buildingsQueries";

type AddBuildingDialogProps = {
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly worldId: string;
};

export function AddBuildingDialog({
  onClose,
  queryClient,
  settlementId,
  worldId,
}: AddBuildingDialogProps): JSX.Element {
  const blueprintSelectId = useId();
  const tierSelectId = useId();
  const nameInputId = useId();

  const [selectedBlueprintId, setSelectedBlueprintId] = useState("");
  const [selectedTierId, setSelectedTierId] = useState("");
  const [name, setName] = useState("");

  const blueprintsQuery = useQuery(blueprintsByWorldQueryOptions(worldId));
  const tiersQuery = useQuery({
    ...tiersByBlueprintQueryOptions(selectedBlueprintId),
    enabled: selectedBlueprintId !== "",
  });

  const addMutation = useMutation(
    addSettlementBuildingMutationOptions({ queryClient, settlementId }),
  );

  const availableBlueprints =
    blueprintsQuery.data?.filter((b) => !b.isTrashed) ?? [];

  async function handleAdd(): Promise<void> {
    if (selectedBlueprintId === "" || selectedTierId === "") return;
    try {
      await addMutation.mutateAsync({
        blueprintId: selectedBlueprintId,
        name: name.trim() !== "" ? name.trim() : undefined,
        settlementId,
        tierId: selectedTierId,
      });
      notifyMutationSuccess("Building added.");
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to add building.");
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add building</DialogTitle>
          <DialogDescription>
            Add a building from an available blueprint and tier.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor={blueprintSelectId}>Blueprint</Label>
            {blueprintsQuery.isPending ? (
              <p className="text-sm text-muted-foreground">
                Loading blueprints…
              </p>
            ) : blueprintsQuery.isError ? (
              <p className="text-sm text-destructive">
                {getErrorDescription(blueprintsQuery.error)}
              </p>
            ) : (
              <NativeSelect
                className="w-full"
                id={blueprintSelectId}
                value={selectedBlueprintId}
                onChange={(e) => {
                  setSelectedBlueprintId(e.target.value);
                  setSelectedTierId("");
                }}
              >
                <option value="">Select a blueprint…</option>
                {availableBlueprints.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </div>

          {selectedBlueprintId !== "" ? (
            <div className="grid gap-1.5">
              <Label htmlFor={tierSelectId}>Tier</Label>
              {tiersQuery.isPending ? (
                <p className="text-sm text-muted-foreground">Loading tiers…</p>
              ) : tiersQuery.isError ? (
                <p className="text-sm text-destructive">
                  {getErrorDescription(tiersQuery.error)}
                </p>
              ) : (
                <NativeSelect
                  className="w-full"
                  id={tierSelectId}
                  value={selectedTierId}
                  onChange={(e) => {
                    setSelectedTierId(e.target.value);
                  }}
                >
                  <option value="">Select a tier…</option>
                  {(tiersQuery.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      Tier {t.tierNumber}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </div>
          ) : null}

          <div className="grid gap-1.5">
            <Label htmlFor={nameInputId}>
              Name{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              id={nameInputId}
              maxLength={200}
              placeholder="Leave blank to use blueprint name"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.currentTarget.value);
              }}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={addMutation.isPending}
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            disabled={
              addMutation.isPending ||
              selectedBlueprintId === "" ||
              selectedTierId === ""
            }
            type="button"
            onClick={() => {
              void handleAdd();
            }}
          >
            Add building
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
