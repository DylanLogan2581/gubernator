import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { Save, Shuffle, UserPlus, Wand2, X } from "lucide-react";
import { useId, useMemo, useState, type FormEvent, type JSX } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  worldNamingConfigQueryOptions,
  worldNpcFlavorConfigQueryOptions,
} from "@/features/worlds";
import { textInputLimits } from "@/lib/inputLimits";
import { notifyMutationSuccess } from "@/lib/notify";
import { createSeededRng } from "@/lib/seededRng";

import { createNpcMutationOptions } from "../../mutations/citizensMutations";
import { citizensHaveCloseKinship } from "../../queries/citizenKinshipQueries";
import { citizensInSettlementQueryOptions } from "../../queries/citizensQueries";
import {
  EMPTY_COMMON_FIELDS,
  getCreationErrorDescription,
  normalizeOptionalText,
  normalizeOptionalUuid,
  validateParentPairing,
} from "../../utils/citizenCreationUtils";
import { emptyNpcFlavor, generateNpcFlavor } from "../../utils/npcFlavor";
import {
  generateNpcName,
  relevantPoolIsEmpty,
} from "../../utils/npcNameGeneration";

import type { Citizen } from "../../types/citizenTypes";
import type { NpcFlavor } from "../../utils/npcFlavor";

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
  const [seed, setSeed] = useState(() => crypto.randomUUID());
  const [userFlavor, setUserFlavor] = useState<NpcFlavor | null>(null);
  const citizensQuery = useQuery(
    citizensInSettlementQueryOptions(settlementId),
  );
  const flavorConfigQuery = useQuery(worldNpcFlavorConfigQueryOptions(worldId));
  const namingConfigQuery = useQuery(worldNamingConfigQueryOptions(worldId));
  const mutation = useMutation(createNpcMutationOptions({ queryClient }));

  const generatedFlavor = useMemo(() => {
    const config = flavorConfigQuery.data;
    if (config === undefined) return emptyNpcFlavor();
    return generateNpcFlavor(config, createSeededRng(seed));
  }, [flavorConfigQuery.data, seed]);

  const flavor = userFlavor ?? generatedFlavor;

  function handleRegenerate(): void {
    setSeed(crypto.randomUUID());
    setUserFlavor(null);
  }

  function handleFlavorChange(field: keyof NpcFlavor, value: string): void {
    setUserFlavor({ ...flavor, [field]: value });
  }

  const parentChoices = (citizensQuery.data ?? []).filter(
    (citizen) => citizen.status === "alive",
  );

  const namingConfig = namingConfigQuery.data;

  const nameGenerationHint: string | null = (() => {
    if (namingConfig === undefined) return null;
    if (relevantPoolIsEmpty(namingConfig, fields.sex)) {
      return "Name pool is empty. Add names in world naming settings.";
    }
    return null;
  })();

  const nameGenerationDisabled =
    mutation.isPending ||
    namingConfig === undefined ||
    nameGenerationHint !== null;

  function handleGenerateName(): void {
    if (namingConfig === undefined) return;
    const parentA = parentChoices.find((c) => c.id === fields.parentACitizenId);
    const parentB = parentChoices.find((c) => c.id === fields.parentBCitizenId);
    const name = generateNpcName({
      config: namingConfig,
      rng: createSeededRng(crypto.randomUUID()),
      sex: fields.sex !== "" ? fields.sex : null,
      parentAName: parentA?.name ?? null,
      parentBName: parentB?.name ?? null,
    });
    if (name !== "") {
      setFields((current) => ({ ...current, name }));
    }
  }

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
          npcFlaw: flavor.flaw !== "" ? flavor.flaw : null,
          npcGoal: flavor.goal !== "" ? flavor.goal : null,
          npcSecretContradiction:
            flavor.contradiction !== "" ? flavor.contradiction : null,
          npcTrait1: flavor.trait1 !== "" ? flavor.trait1 : null,
          npcTrait2: flavor.trait2 !== "" ? flavor.trait2 : null,
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
          onError: (error) => {
            toast.error(getCreationErrorDescription(error));
          },
          onSuccess: (citizen) => {
            notifyMutationSuccess("NPC created.");
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

  const fieldError = kinshipError;

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

        <div className="grid gap-1 text-sm">
          <label className="text-muted-foreground" htmlFor={nameId}>
            Name
          </label>
          <div className="flex gap-2">
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
            <Button
              aria-label="Generate name from world naming pools"
              disabled={nameGenerationDisabled}
              onClick={handleGenerateName}
              size="sm"
              type="button"
              variant="outline"
            >
              <Shuffle aria-hidden="true" />
              Generate
            </Button>
          </div>
          {nameGenerationHint !== null ? (
            <p className="text-xs text-muted-foreground">
              {nameGenerationHint}
            </p>
          ) : null}
        </div>

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

        <div className="grid gap-3 rounded-md border border-border bg-muted/30 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium">NPC flavor</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={
                mutation.isPending || flavorConfigQuery.data === undefined
              }
              onClick={handleRegenerate}
            >
              <Wand2 aria-hidden="true" />
              Regenerate
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Trait 1</span>
              <Input
                disabled={mutation.isPending}
                value={flavor.trait1}
                onChange={(event) =>
                  handleFlavorChange("trait1", event.currentTarget.value)
                }
              />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Trait 2</span>
              <Input
                disabled={mutation.isPending}
                value={flavor.trait2}
                onChange={(event) =>
                  handleFlavorChange("trait2", event.currentTarget.value)
                }
              />
            </label>
          </div>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">
              Secret / contradiction
            </span>
            <textarea
              className="min-h-16 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              disabled={mutation.isPending}
              value={flavor.contradiction}
              onChange={(event) =>
                handleFlavorChange("contradiction", event.currentTarget.value)
              }
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Goal</span>
            <textarea
              className="min-h-16 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              disabled={mutation.isPending}
              value={flavor.goal}
              onChange={(event) =>
                handleFlavorChange("goal", event.currentTarget.value)
              }
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Flaw</span>
            <textarea
              className="min-h-16 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              disabled={mutation.isPending}
              value={flavor.flaw}
              onChange={(event) =>
                handleFlavorChange("flaw", event.currentTarget.value)
              }
            />
          </label>
        </div>

        {fieldError === undefined ? null : (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {fieldError}
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
