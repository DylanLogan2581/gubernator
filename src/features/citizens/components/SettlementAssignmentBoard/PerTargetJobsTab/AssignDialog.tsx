import { useState, type JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { Citizen } from "../../../types/citizenTypes";

type AssignDialogProps = {
  readonly aliveCitizens: readonly Citizen[];
  readonly currentCitizenIds: readonly string[];
  readonly isPending: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (citizenIds: string[]) => void;
  readonly title: string;
};

export function AssignDialog({
  aliveCitizens,
  currentCitizenIds,
  isPending,
  onClose,
  onSubmit,
  title,
}: AssignDialogProps): JSX.Element {
  const [selected, setSelected] = useState<ReadonlySet<string>>(
    () => new Set(currentCitizenIds),
  );

  function handleToggle(citizenId: string, checked: boolean): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(citizenId);
      } else {
        next.delete(citizenId);
      }
      return next;
    });
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
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-72 overflow-y-auto">
          {aliveCitizens.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No alive citizens in this settlement.
            </p>
          ) : (
            <ul className="grid gap-0.5">
              {aliveCitizens.map((citizen) => (
                <li key={citizen.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
                    <input
                      checked={selected.has(citizen.id)}
                      className="accent-foreground"
                      disabled={isPending}
                      type="checkbox"
                      onChange={(e) => {
                        handleToggle(citizen.id, e.currentTarget.checked);
                      }}
                    />
                    {citizen.name}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button
            disabled={isPending}
            size="sm"
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            disabled={isPending}
            size="sm"
            type="button"
            onClick={() => {
              onSubmit([...selected]);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
