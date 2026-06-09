import { useMutation, type QueryClient } from "@tanstack/react-query";
import { Pencil, Save, X } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { textInputLimits } from "@/lib/inputLimits";

import { updateSettlementDetailsMutationOptions } from "../../mutations/settlementsMutations";

import { getMutationErrorDescription } from "./ErrorMessages";

import type { SettlementWithNation } from "../../types/settlementTypes";

export function SettlementDetailsSection({
  canEdit,
  queryClient,
  settlement,
}: {
  readonly canEdit: boolean;
  readonly queryClient: QueryClient;
  readonly settlement: SettlementWithNation;
}): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(settlement.name);
  const [description, setDescription] = useState(settlement.description ?? "");
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  const updateMutation = useMutation(
    updateSettlementDetailsMutationOptions({ queryClient }),
  );

  function resetForm(): void {
    setName(settlement.name);
    setDescription(settlement.description ?? "");
    setNameError(undefined);
    updateMutation.reset();
  }

  function closeEditor(): void {
    setIsEditing(false);
    resetForm();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setNameError(undefined);
    updateMutation.reset();

    if (name.trim().length === 0) {
      setNameError("Settlement name is required.");
      return;
    }

    updateMutation.mutate(
      {
        description: description.trim().length === 0 ? null : description,
        name,
        nationId: settlement.nationId,
        settlementId: settlement.id,
        worldId: settlement.nation.worldId,
      },
      {
        onError: (error) => {
          toast.error(getMutationErrorDescription(error));
        },
        onSuccess: () => {
          setIsEditing(false);
        },
      },
    );
  }

  if (!isEditing) {
    return (
      <section
        aria-labelledby="settlement-details-heading"
        className="grid gap-3 p-4"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="settlement-details-heading" className="text-base font-medium">
            Details
          </h2>
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
            >
              <Pencil aria-hidden="true" />
              Edit
            </Button>
          ) : null}
        </div>
        {settlement.description === null ? (
          <p className="text-sm italic text-muted-foreground">
            No description.
          </p>
        ) : (
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
            {settlement.description}
          </p>
        )}
      </section>
    );
  }

  return (
    <form
      aria-label="Edit settlement details"
      className="grid gap-3 p-4"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">Edit details</h2>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={closeEditor}
          aria-label="Cancel edit"
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <Label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Name</span>
        <Input
          aria-invalid={nameError === undefined ? undefined : true}
          aria-describedby={
            nameError === undefined ? undefined : "settlement-detail-name-error"
          }
          disabled={updateMutation.isPending}
          maxLength={textInputLimits.settlementNameMax}
          required
          value={name}
          onChange={(event) => {
            setName(event.currentTarget.value);
            if (nameError !== undefined) {
              setNameError(undefined);
            }
          }}
        />
        {nameError === undefined ? null : (
          <p
            id="settlement-detail-name-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {nameError}
          </p>
        )}
      </Label>
      <Label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Description</span>
        <textarea
          className="min-h-[6rem] rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          disabled={updateMutation.isPending}
          maxLength={textInputLimits.settlementDescriptionMax}
          value={description}
          onChange={(event) => setDescription(event.currentTarget.value)}
        />
      </Label>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={updateMutation.isPending}>
          <Save aria-hidden="true" />
          {updateMutation.isPending ? "Saving…" : "Save changes"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={closeEditor}
          disabled={updateMutation.isPending}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
