import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { Save, UserPlus } from "lucide-react";
import { useId, useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";

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

          <label className="grid gap-1 text-sm" htmlFor={givenNameId}>
            <span className="text-muted-foreground">Given name</span>
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
          </label>

          <label className="grid gap-1 text-sm" htmlFor={surnameId}>
            <span className="text-muted-foreground">Surname</span>
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
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Sex</span>
            <select
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
              disabled={mutation.isPending}
              value={fields.sex}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setFields((current) => ({ ...current, sex: value }));
              }}
            >
              <option value=""></option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>

          <label className="grid gap-1 text-sm" htmlFor={userId}>
            <span className="text-muted-foreground">User</span>
            <select
              id={userId}
              className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
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
            </select>
          </label>

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
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {formError}
            </p>
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
    <label className="grid gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select
        className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
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
      </select>
    </label>
  );
}
