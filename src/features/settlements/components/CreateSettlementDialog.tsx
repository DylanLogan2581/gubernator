import { useMutation, type QueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
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
import { Textarea } from "@/components/ui/textarea";
import { textInputLimits } from "@/lib/inputLimits";
import { notifyMutationSuccess, notifyMutationError } from "@/lib/notify";

import { createSettlementMutationOptions } from "../mutations/settlementsMutations";

import type { CreateSettlementInput } from "../schemas/settlementSchemas";

export type CreateSettlementDialogProps = {
  readonly nationId: string;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly worldId: string;
};

export function CreateSettlementDialog({
  nationId,
  onClose,
  queryClient,
  worldId,
}: CreateSettlementDialogProps): JSX.Element {
  const navigate = useNavigate();
  const nameId = useId();
  const descriptionId = useId();
  const coordXId = useId();
  const coordZId = useId();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coordX, setCoordX] = useState("");
  const [coordZ, setCoordZ] = useState("");
  const [formError, setFormError] = useState<string | undefined>(undefined);

  const mutation = useMutation(
    createSettlementMutationOptions({ queryClient }),
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setFormError(undefined);

    const input: CreateSettlementInput = {
      name: name.trim(),
      description:
        description.trim().length > 0 ? description.trim() : undefined,
      coordX: coordX.trim().length > 0 ? Number(coordX) : undefined,
      coordZ: coordZ.trim().length > 0 ? Number(coordZ) : undefined,
      nationId,
      worldId,
    };

    mutation.mutate(input, {
      onError: (error) => {
        setFormError(error.message);
        notifyMutationError(error, "Failed to create settlement.");
      },
      onSuccess: (result) => {
        notifyMutationSuccess("Settlement created successfully.", {
          description: result.name,
        });
        onClose();
        void navigate({
          to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId",
          params: {
            worldId,
            nationId,
            settlementId: result.id,
          },
        });
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
        <DialogHeader>
          <DialogTitle>Create Settlement</DialogTitle>
          <DialogDescription>
            Create a new settlement in this nation. Name is required; other
            fields are optional.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={nameId} className="text-sm font-medium">
              Name <span className="text-destructive">*</span>
            </label>
            <Input
              id={nameId}
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.currentTarget.value);
              }}
              placeholder="Settlement name"
              maxLength={textInputLimits.settlementNameMax}
              required
              autoComplete="off"
              disabled={mutation.isPending}
            />
            {name.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {name.length} / {textInputLimits.settlementNameMax}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={descriptionId} className="text-sm font-medium">
              Description
            </label>
            <Textarea
              id={descriptionId}
              value={description}
              onChange={(e) => {
                setDescription(e.currentTarget.value);
              }}
              placeholder="Settlement description (optional)"
              maxLength={textInputLimits.settlementDescriptionMax}
              disabled={mutation.isPending}
              className="resize-none"
              rows={3}
            />
            {description.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {description.length} /{" "}
                {textInputLimits.settlementDescriptionMax}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor={coordXId} className="text-sm font-medium">
                Coordinate X
              </label>
              <Input
                id={coordXId}
                type="number"
                value={coordX}
                onChange={(e) => {
                  setCoordX(e.currentTarget.value);
                }}
                placeholder="Optional"
                disabled={mutation.isPending}
                step="any"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor={coordZId} className="text-sm font-medium">
                Coordinate Z
              </label>
              <Input
                id={coordZId}
                type="number"
                value={coordZ}
                onChange={(e) => {
                  setCoordZ(e.currentTarget.value);
                }}
                placeholder="Optional"
                disabled={mutation.isPending}
                step="any"
              />
            </div>
          </div>

          {formError !== undefined && (
            <p className="text-sm text-destructive">{formError}</p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create settlement"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
