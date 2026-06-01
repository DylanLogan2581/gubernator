import { useMutation, type QueryClient } from "@tanstack/react-query";
import { Pencil, Save, X } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { textInputLimits } from "@/lib/inputLimits";

import { updateCitizenCoreMutationOptions } from "../../mutations/citizensMutations";

import { getCitizenMutationErrorDescription } from "./ErrorMessages";
import { Readout } from "./Shared";

import type { Citizen } from "../../types/citizenTypes";

export function CitizenCoreSection({
  canEdit,
  citizen,
  queryClient,
}: {
  readonly canEdit: boolean;
  readonly citizen: Citizen;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(citizen.name);
  const [sex, setSex] = useState(citizen.sex ?? "");
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  const updateMutation = useMutation(
    updateCitizenCoreMutationOptions({ queryClient }),
  );

  function resetForm(): void {
    setName(citizen.name);
    setSex(citizen.sex ?? "");
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
      setNameError("Citizen name is required.");
      return;
    }

    updateMutation.mutate(
      {
        citizenId: citizen.id,
        name,
        sex,
        worldId: citizen.worldId,
      },
      {
        onError: (error) => {
          toast.error(getCitizenMutationErrorDescription(error));
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
        aria-labelledby="citizen-core-heading"
        className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id="citizen-core-heading" className="text-base font-medium">
            Core info
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
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Readout label="Name" value={citizen.name} />
          <Readout label="Sex" value={citizen.sex} />
          <Readout
            label="Born on turn"
            value={
              citizen.bornOnTurnNumber === null
                ? null
                : String(citizen.bornOnTurnNumber)
            }
          />
          <Readout
            label="Status"
            value={citizen.status === "alive" ? "Alive" : "Deceased"}
          />
        </dl>
      </section>
    );
  }

  return (
    <form
      aria-label="Edit citizen core"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">Edit core info</h2>
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
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Name</span>
        <Input
          aria-invalid={nameError === undefined ? undefined : true}
          aria-describedby={
            nameError === undefined ? undefined : "citizen-core-name-error"
          }
          disabled={updateMutation.isPending}
          maxLength={textInputLimits.citizenNameMax}
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
            id="citizen-core-name-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {nameError}
          </p>
        )}
      </label>
      <label className="grid gap-1 text-sm">
        <span className="text-muted-foreground">Sex</span>
        <select
          className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
          disabled={updateMutation.isPending}
          value={sex}
          onChange={(event) => setSex(event.currentTarget.value)}
        >
          <option value=""></option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
      </label>
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
