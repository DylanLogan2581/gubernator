import { useQuery } from "@tanstack/react-query";
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
import { getErrorDescription } from "@/lib/errorUtils";

import { armyGroupsByArmyQueryOptions } from "../../queries/armiesQueries";
import { unitTypesByWorldQueryOptions } from "../../queries/unitTypesQueries";

// Generic name dialog shared by rename-army-group, rename-army-unit, and the
// two "add" forms (which also just collect a name, plus an optional unit
// type for units).
export function RenameNodeDialog({
  currentName,
  isPending,
  onClose,
  onSave,
  title,
}: {
  readonly currentName: string;
  readonly isPending: boolean;
  readonly onClose: () => void;
  readonly onSave: (name: string) => Promise<void>;
  readonly title: string;
}): JSX.Element {
  const inputId = useId();
  const [name, setName] = useState(currentName);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    await onSave(name);
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
            <DialogTitle>{title}</DialogTitle>
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
              disabled={isPending}
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button disabled={isPending || name.trim() === ""} type="submit">
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AddUnitDialog({
  isPending,
  onClose,
  onCreate,
  worldId,
}: {
  readonly isPending: boolean;
  readonly onClose: () => void;
  readonly onCreate: (name: string, unitTypeId: string) => Promise<void>;
  readonly worldId: string;
}): JSX.Element {
  const nameInputId = useId();
  const unitTypeSelectId = useId();
  const [name, setName] = useState("");
  const [unitTypeId, setUnitTypeId] = useState("");

  const unitTypesQuery = useQuery(unitTypesByWorldQueryOptions(worldId));
  const unitTypes = unitTypesQuery.data ?? [];

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    if (unitTypeId === "") return;
    await onCreate(name, unitTypeId);
  }

  let unitTypeField: JSX.Element;
  if (unitTypesQuery.isPending) {
    unitTypeField = (
      <p className="text-sm text-muted-foreground">Loading unit types…</p>
    );
  } else if (unitTypesQuery.isError) {
    unitTypeField = (
      <p className="text-sm text-destructive">
        {getErrorDescription(unitTypesQuery.error)}
      </p>
    );
  } else {
    unitTypeField = (
      <div className="grid gap-1.5">
        <Label htmlFor={unitTypeSelectId}>Unit type</Label>
        <NativeSelect
          id={unitTypeSelectId}
          required
          value={unitTypeId}
          onChange={(e) => setUnitTypeId(e.target.value)}
        >
          <option value="">Select a unit type…</option>
          {unitTypes.map((unitType) => (
            <option key={unitType.id} value={unitType.id}>
              {unitType.name}
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
        <form
          className="contents"
          noValidate
          onSubmit={(e) => void handleSubmit(e)}
        >
          <DialogHeader>
            <DialogTitle>Add unit</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor={nameInputId}>Name</Label>
              <Input
                autoFocus
                id={nameInputId}
                maxLength={64}
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            {unitTypeField}
          </div>
          <DialogFooter>
            <Button
              disabled={isPending}
              type="button"
              variant="outline"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              disabled={
                isPending ||
                unitTypesQuery.isPending ||
                unitTypesQuery.isError ||
                name.trim() === "" ||
                unitTypeId === ""
              }
              type="submit"
            >
              Add unit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type MoveDestination = { readonly id: string | null; readonly label: string };

// Flat list of "army root" + every other group in the army, for a "move to"
// picker shared by groups and units. Excludes the node's own subtree when a
// set of excluded group ids is supplied (client-side courtesy only -- the
// RPC is the real cycle guard).
export function MoveNodeDialog({
  armyId,
  currentGroupId,
  excludedGroupIds,
  isPending,
  onClose,
  onMove,
  title,
}: {
  readonly armyId: string;
  readonly currentGroupId: string | null;
  readonly excludedGroupIds: ReadonlySet<string>;
  readonly isPending: boolean;
  readonly onClose: () => void;
  readonly onMove: (groupId: string | null) => Promise<void>;
  readonly title: string;
}): JSX.Element {
  const selectId = useId();
  const [destination, setDestination] = useState<string>(currentGroupId ?? "");

  const groupsQuery = useQuery(armyGroupsByArmyQueryOptions(armyId));
  const groups = groupsQuery.data ?? [];

  const destinations: readonly MoveDestination[] = [
    { id: null, label: "Army root" },
    ...groups
      .filter((group) => !excludedGroupIds.has(group.id))
      .map((group) => ({ id: group.id, label: group.name })),
  ];

  async function handleConfirm(): Promise<void> {
    await onMove(destination === "" ? null : destination);
  }

  let body: JSX.Element;
  if (groupsQuery.isPending) {
    body = <p className="text-sm text-muted-foreground">Loading groups…</p>;
  } else if (groupsQuery.isError) {
    body = (
      <p className="text-sm text-destructive">
        {getErrorDescription(groupsQuery.error)}
      </p>
    );
  } else {
    body = (
      <div className="grid gap-1.5">
        <Label htmlFor={selectId}>Destination</Label>
        <NativeSelect
          id={selectId}
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        >
          {destinations.map((dest) => (
            <option key={dest.id ?? "root"} value={dest.id ?? ""}>
              {dest.label}
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
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Choose a destination within this army.
          </DialogDescription>
        </DialogHeader>

        {body}

        <DialogFooter>
          <Button
            disabled={isPending}
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            disabled={isPending || groupsQuery.isPending || groupsQuery.isError}
            type="button"
            onClick={() => void handleConfirm()}
          >
            Move
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
