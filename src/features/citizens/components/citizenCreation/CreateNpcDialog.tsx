import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { Save, UserPlus, X } from "lucide-react";
import { useId, useState, type FormEvent, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { textInputLimits } from "@/lib/inputLimits";

import { createNpcMutationOptions } from "../../mutations/citizensMutations";
import { citizensHaveCloseKinship } from "../../queries/citizenKinshipQueries";
import { citizensInSettlementQueryOptions } from "../../queries/citizensQueries";

import {
  EMPTY_COMMON_FIELDS,
  getCreationErrorDescription,
  normalizeOptionalText,
  normalizeOptionalUuid,
  validateParentPairing,
} from "./CitizenCreationShared";

import type { Citizen } from "../../types/citizenTypes";

type CreateNpcDialogProps = {
  readonly incestPreventionDepth: number;
  readonly onClose: () => void;
  readonly onCreated: (citizen: Citizen) => void;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly worldId: string;
};

export function CreateNpcDialog({
  incestPreventionDepth,
  onClose,
  onCreated,
  queryClient,
  settlementId,
  worldId,
}: CreateNpcDialogProps): JSX.Element {
  const titleId = useId();
  const nameId = useId();
  const [fields, setFields] = useState(EMPTY_COMMON_FIELDS);
  const [kinshipError, setKinshipError] = useState<string | undefined>(
    undefined,
  );
  const citizensQuery = useQuery(
    citizensInSettlementQueryOptions(settlementId),
  );
  const mutation = useMutation(createNpcMutationOptions({ queryClient }));

  const parentChoices = (citizensQuery.data ?? []).filter(
    (citizen) => citizen.status === "alive",
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const trimmedName = fields.name.trim();
    if (trimmedName === "") {
      return;
    }

    const pairingError = validateParentPairing(
      fields.parentACitizenId,
      fields.parentBCitizenId,
    );
    if (pairingError !== undefined) {
      setKinshipError(pairingError);
      return;
    }

    const parentACitizenId = normalizeOptionalUuid(fields.parentACitizenId);
    const parentBCitizenId = normalizeOptionalUuid(fields.parentBCitizenId);

    const runMutation = (): void => {
      setKinshipError(undefined);
      mutation.mutate(
        {
          name: trimmedName,
          npcFlaw: null,
          npcGoal: null,
          npcSecretContradiction: null,
          npcTrait1: null,
          npcTrait2: null,
          parentACitizenId,
          parentBCitizenId,
          personalityText: null,
          profilePhotoUrl: null,
          settlementId,
          sex: normalizeOptionalText(fields.sex),
          skillsText: null,
          worldId,
        },
        {
          onSuccess: (citizen) => {
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
          setKinshipError(
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

  const errorDescription =
    kinshipError !== undefined
      ? kinshipError
      : mutation.isError
        ? getCreationErrorDescription(mutation.error)
        : "";

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4">
      <form
        aria-labelledby={titleId}
        aria-modal="true"
        className="grid w-full max-w-lg gap-4 rounded-md border border-border bg-card p-5 text-card-foreground shadow-lg"
        noValidate
        onSubmit={handleSubmit}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h3 id={titleId} className="text-lg font-semibold">
              Create NPC
            </h3>
            <p className="text-sm text-muted-foreground">
              NPCs are managed by World Admins and are not linked to a user.
            </p>
          </div>
          <Button
            aria-label="Cancel create NPC"
            disabled={mutation.isPending}
            onClick={onClose}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        <label className="grid gap-1 text-sm" htmlFor={nameId}>
          <span className="text-muted-foreground">Name</span>
          <Input
            id={nameId}
            disabled={mutation.isPending}
            maxLength={textInputLimits.citizenNameMax}
            required
            value={fields.name}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setFields((current) => ({ ...current, name: value }));
            }}
          />
        </label>

        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Sex</span>
          <Input
            disabled={mutation.isPending}
            placeholder="Optional"
            value={fields.sex}
            onChange={(event) => {
              const value = event.currentTarget.value;
              setFields((current) => ({ ...current, sex: value }));
            }}
          />
        </label>

        <ParentField
          citizens={parentChoices}
          disabled={mutation.isPending || citizensQuery.isPending}
          label="Parent A"
          onChange={(value) => {
            setFields((current) => ({ ...current, parentACitizenId: value }));
            setKinshipError(undefined);
          }}
          value={fields.parentACitizenId}
        />

        <ParentField
          citizens={parentChoices}
          disabled={mutation.isPending || citizensQuery.isPending}
          label="Parent B"
          onChange={(value) => {
            setFields((current) => ({ ...current, parentBCitizenId: value }));
            setKinshipError(undefined);
          }}
          value={fields.parentBCitizenId}
        />

        {errorDescription === "" ? null : (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {errorDescription}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
            {mutation.isPending ? "Creating…" : "Create NPC"}
          </Button>
        </div>
      </form>
    </div>
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
