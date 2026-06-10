import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { Save, UserPlus } from "lucide-react";
import { useId, useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { availableUsersQueryOptions } from "@/features/auth";
import { textInputLimits } from "@/lib/inputLimits";
import { notifyMutationSuccess } from "@/lib/notify";

import { createPlayerCharacterMutationOptions } from "../../mutations/citizensMutations";
import { citizensHaveCloseKinship } from "../../queries/citizenKinshipQueries";
import { citizensInSettlementQueryOptions } from "../../queries/citizensQueries";
import {
  EMPTY_COMMON_FIELDS,
  getCreationErrorDescription,
  normalizeOptionalText,
  normalizeOptionalUuid,
  validateParentPairing,
} from "../../utils/citizenCreationUtils";

import type { Citizen } from "../../types/citizenTypes";

type CreatePlayerCharacterDialogProps = {
  readonly incestPreventionDepth: number;
  readonly onClose: () => void;
  readonly onCreated: (citizen: Citizen) => void;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly worldId: string;
};

export function CreatePlayerCharacterDialog({
  incestPreventionDepth,
  onClose,
  onCreated,
  queryClient,
  settlementId,
  worldId,
}: CreatePlayerCharacterDialogProps): JSX.Element {
  const givenNameId = useId();
  const surnameId = useId();
  const userId = useId();
  const [fields, setFields] = useState({
    ...EMPTY_COMMON_FIELDS,
    userId: "",
  });
  const [formError, setFormError] = useState<string | undefined>(undefined);

  const citizensQuery = useQuery(
    citizensInSettlementQueryOptions(settlementId),
  );
  const usersQuery = useQuery(availableUsersQueryOptions());
  const mutation = useMutation(
    createPlayerCharacterMutationOptions({ queryClient }),
  );

  const parentChoices = (citizensQuery.data ?? []).filter(
    (citizen) => citizen.status === "alive",
  );
  const userChoices = usersQuery.data ?? [];

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const trimmedGivenName = fields.givenName.trim();
    if (trimmedGivenName === "") {
      return;
    }
    if (fields.userId === "") {
      setFormError("Pick a user to link the player character to.");
      return;
    }

    const pairingError = validateParentPairing(
      fields.parentACitizenId,
      fields.parentBCitizenId,
    );
    if (pairingError !== undefined) {
      setFormError(pairingError);
      return;
    }

    const parentACitizenId = normalizeOptionalUuid(fields.parentACitizenId);
    const parentBCitizenId = normalizeOptionalUuid(fields.parentBCitizenId);

    const runMutation = (): void => {
      setFormError(undefined);
      mutation.mutate(
        {
          givenName: trimmedGivenName,
          surname: fields.surname.trim() !== "" ? fields.surname.trim() : null,
          parentACitizenId,
          parentBCitizenId,
          personalityText: null,
          profilePhotoUrl: null,
          settlementId,
          sex: normalizeOptionalText(fields.sex),
          skillsText: null,
          userId: fields.userId,
          worldId,
        },
        {
          onError: (error) => {
            toast.error(getCreationErrorDescription(error));
          },
          onSuccess: (citizen) => {
            notifyMutationSuccess("Player character created.");
            onCreated(citizen);
            onClose();
          },
        },
      );
    };

    if (
      parentACitizenId !== null &&
      parentBCitizenId !== null &&
      incestPreventionDepth > 0
    ) {
      void citizensHaveCloseKinship({
        citizenAId: parentACitizenId,
        citizenBId: parentBCitizenId,
        depth: incestPreventionDepth,
      }).then((tooClose) => {
        if (tooClose) {
          setFormError(
            `Parents share a common ancestor within ${incestPreventionDepth} generations. Pick less-related parents.`,
          );
          return;
        }
        runMutation();
      });
      return;
    }

    runMutation();
  };

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
            <DialogTitle>Create player character</DialogTitle>
            <DialogDescription>
              Player characters are linked to a user account at creation.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1 text-sm">
            <Label htmlFor={givenNameId}>Given name</Label>
            <Input
              id={givenNameId}
              disabled={mutation.isPending}
              maxLength={textInputLimits.citizenNameMax}
              required
              value={fields.givenName}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setFields((current) => ({ ...current, givenName: value }));
              }}
            />
          </div>

          <div className="grid gap-1 text-sm">
            <Label htmlFor={surnameId}>Surname</Label>
            <Input
              id={surnameId}
              disabled={mutation.isPending}
              maxLength={textInputLimits.citizenNameMax}
              value={fields.surname}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setFields((current) => ({ ...current, surname: value }));
              }}
            />
          </div>

          <div className="grid gap-1 text-sm">
            <Label>Sex</Label>
            <NativeSelect
              aria-label="Sex"
              disabled={mutation.isPending}
              value={fields.sex}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setFields((current) => ({ ...current, sex: value }));
              }}
            >
              <option value="">Unspecified</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </NativeSelect>
          </div>

          <div className="grid gap-1 text-sm">
            <Label htmlFor={userId}>User</Label>
            <NativeSelect
              id={userId}
              disabled={mutation.isPending || usersQuery.isPending}
              required
              value={fields.userId}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setFields((current) => ({ ...current, userId: value }));
                setFormError(undefined);
              }}
            >
              <option value="">Select a user…</option>
              {userChoices.map((appUser) => (
                <option key={appUser.id} value={appUser.id}>
                  {appUser.username}
                </option>
              ))}
            </NativeSelect>
          </div>

          <ParentField
            citizens={parentChoices}
            disabled={mutation.isPending || citizensQuery.isPending}
            label="Parent A"
            onChange={(value) => {
              setFields((current) => ({ ...current, parentACitizenId: value }));
              setFormError(undefined);
            }}
            value={fields.parentACitizenId}
          />

          <ParentField
            citizens={parentChoices}
            disabled={mutation.isPending || citizensQuery.isPending}
            label="Parent B"
            onChange={(value) => {
              setFields((current) => ({ ...current, parentBCitizenId: value }));
              setFormError(undefined);
            }}
            value={fields.parentBCitizenId}
          />

          {formError === undefined ? null : (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          )}

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
              {mutation.isPending ? (
                <Save aria-hidden="true" />
              ) : (
                <UserPlus aria-hidden="true" />
              )}
              {mutation.isPending ? "Creating…" : "Create player character"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ParentField({
  citizens,
  disabled,
  label,
  onChange,
  value,
}: {
  readonly citizens: readonly Citizen[];
  readonly disabled: boolean;
  readonly label: string;
  readonly onChange: (value: string) => void;
  readonly value: string;
}): JSX.Element {
  return (
    <div className="grid gap-1 text-sm">
      <Label>{label}</Label>
      <NativeSelect
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        <option value="">None</option>
        {citizens.map((citizen) => (
          <option key={citizen.id} value={citizen.id}>
            {citizen.name}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
