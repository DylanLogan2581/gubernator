import { useMutation, type QueryClient } from "@tanstack/react-query";
import { Pencil, Save, X } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
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
  const [givenName, setGivenName] = useState(citizen.givenName);
  const [surname, setSurname] = useState(citizen.surname ?? "");
  const [sex, setSex] = useState(citizen.sex ?? "");
  const [givenNameError, setGivenNameError] = useState<string | undefined>(
    undefined,
  );

  const updateMutation = useMutation(
    updateCitizenCoreMutationOptions({ queryClient }),
  );

  function resetForm(): void {
    setGivenName(citizen.givenName);
    setSurname(citizen.surname ?? "");
    setSex(citizen.sex ?? "");
    setGivenNameError(undefined);
    updateMutation.reset();
  }

  function closeEditor(): void {
    setIsEditing(false);
    resetForm();
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setGivenNameError(undefined);
    updateMutation.reset();

    if (givenName.trim().length === 0) {
      setGivenNameError("Given name is required.");
      return;
    }

    updateMutation.mutate(
      {
        citizenId: citizen.id,
        givenName,
        surname: surname.trim() !== "" ? surname : undefined,
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
      <Card aria-labelledby="citizen-core-heading" className="grid gap-3 p-4">
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
          <Readout label="Given name" value={citizen.givenName} />
          <Readout label="Surname" value={citizen.surname} />
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
      </Card>
    );
  }

  return (
    <form
      aria-label="Edit citizen core"
      className="grid gap-3 p-4"
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
      <div className="grid gap-1 text-sm">
        <Label>Given name</Label>
        <Input
          aria-invalid={givenNameError === undefined ? undefined : true}
          aria-describedby={
            givenNameError === undefined
              ? undefined
              : "citizen-core-given-name-error"
          }
          disabled={updateMutation.isPending}
          maxLength={textInputLimits.citizenNameMax}
          required
          value={givenName}
          onChange={(event) => {
            setGivenName(event.currentTarget.value);
            if (givenNameError !== undefined) {
              setGivenNameError(undefined);
            }
          }}
        />
        {givenNameError === undefined ? null : (
          <p
            id="citizen-core-given-name-error"
            role="alert"
            className="text-sm text-destructive"
          >
            {givenNameError}
          </p>
        )}
      </div>
      <div className="grid gap-1 text-sm">
        <Label>Surname</Label>
        <Input
          disabled={updateMutation.isPending}
          maxLength={textInputLimits.citizenNameMax}
          value={surname}
          onChange={(event) => setSurname(event.currentTarget.value)}
        />
      </div>
      <div className="grid gap-1 text-sm">
        <Label>Sex</Label>
        <NativeSelect
          disabled={updateMutation.isPending}
          value={sex}
          onChange={(event) => setSex(event.currentTarget.value)}
        >
          <option value=""></option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </NativeSelect>
      </div>
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
