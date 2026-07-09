import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { useId, useState, type FormEvent, type JSX } from "react";

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
import { nationSettlementsQueryOptions } from "@/features/nations";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import {
  moveArmyMutationOptions,
  renameArmyMutationOptions,
} from "../../mutations/armiesMutations";

export function RenameArmyDialog({
  armyId,
  currentName,
  nationId,
  onClose,
  queryClient,
}: {
  readonly armyId: string;
  readonly currentName: string;
  readonly nationId: string;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const inputId = useId();
  const [name, setName] = useState(currentName);
  const renameMutation = useMutation(
    renameArmyMutationOptions({ nationId, queryClient }),
  );

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    try {
      await renameMutation.mutateAsync({ armyId, name });
      notifyMutationSuccess("Army renamed.");
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to rename army.");
    }
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <form
          className="contents"
          noValidate
          onSubmit={(e) => void handleSubmit(e)}
        >
          <DialogHeader>
            <DialogTitle>Rename army</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor={inputId}>Name</Label>
            <Input
              autoFocus
              id={inputId}
              maxLength={64}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              disabled={renameMutation.isPending}
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              disabled={renameMutation.isPending || name.trim() === ""}
              type="submit"
            >
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function MoveArmyDialog({
  armyId,
  currentSettlementId,
  nationId,
  onClose,
  queryClient,
}: {
  readonly armyId: string;
  readonly currentSettlementId: string;
  readonly nationId: string;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const selectId = useId();
  const [settlementId, setSettlementId] = useState(currentSettlementId);
  const settlementsQuery = useQuery(nationSettlementsQueryOptions(nationId));
  const moveMutation = useMutation(
    moveArmyMutationOptions({ nationId, queryClient }),
  );

  async function handleConfirm(): Promise<void> {
    try {
      await moveMutation.mutateAsync({ armyId, settlementId });
      notifyMutationSuccess("Army relocated.");
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to move army.");
    }
  }

  const settlements = settlementsQuery.data ?? [];

  let body: JSX.Element;
  if (settlementsQuery.isPending) {
    body = (
      <p className="text-sm text-muted-foreground">Loading settlements…</p>
    );
  } else if (settlementsQuery.isError) {
    body = (
      <p className="text-sm text-destructive">
        {getErrorDescription(settlementsQuery.error)}
      </p>
    );
  } else {
    body = (
      <div className="grid gap-1.5">
        <Label htmlFor={selectId}>Destination settlement</Label>
        <NativeSelect
          id={selectId}
          value={settlementId}
          onChange={(e) => setSettlementId(e.target.value)}
        >
          {settlements.map((settlement) => (
            <option key={settlement.id} value={settlement.id}>
              {settlement.name}
            </option>
          ))}
        </NativeSelect>
      </div>
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Move army</DialogTitle>
          <DialogDescription>
            Relocate this army to a different settlement in the nation.
          </DialogDescription>
        </DialogHeader>

        {body}

        <DialogFooter>
          <Button
            disabled={moveMutation.isPending}
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            disabled={
              moveMutation.isPending ||
              settlementsQuery.isPending ||
              settlementsQuery.isError ||
              settlementId === currentSettlementId
            }
            type="button"
            onClick={() => void handleConfirm()}
          >
            Move army
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
