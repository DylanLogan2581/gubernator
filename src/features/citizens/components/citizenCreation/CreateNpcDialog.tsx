import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { Save, Shuffle, UserPlus, Wand2 } from "lucide-react";
import { useId, useMemo, useState, type FormEvent, type JSX } from "react";
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
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  activeNamesetsByWorldQueryOptions,
  resolveNamingConfig,
} from "@/features/namesets";
import { settlementByIdQueryOptions } from "@/features/settlements";
import { worldNpcFlavorConfigQueryOptions } from "@/features/worlds";
import { textInputLimits } from "@/lib/inputLimits";
import { notifyMutationSuccess } from "@/lib/notify";
import { createSeededRng } from "@/lib/seededRng";
import { generateLocalId } from "@/lib/uid";

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
  const givenNameId = useId();
  const surnameId = useId();
  const [fields, setFields] = useState(EMPTY_COMMON_FIELDS);
  const [kinshipError, setKinshipError] = useState<string | undefined>(
    undefined,
  );
  const [seed, setSeed] = useState(() => generateLocalId());
  const [userFlavor, setUserFlavor] = useState<NpcFlavor | null>(null);
  const citizensQuery = useQuery(
    citizensInSettlementQueryOptions(settlementId),
  );
  const flavorConfigQuery = useQuery(worldNpcFlavorConfigQueryOptions(worldId));
  const namesetsQuery = useQuery(activeNamesetsByWorldQueryOptions(worldId));
  const settlementQuery = useQuery(settlementByIdQueryOptions(settlementId));
  const mutation = useMutation(createNpcMutationOptions({ queryClient }));

  const generatedFlavor = useMemo(() => {
    const config = flavorConfigQuery.data;
    if (config === undefined) return emptyNpcFlavor();
    return generateNpcFlavor(config, createSeededRng(seed));
  }, [flavorConfigQuery.data, seed]);

  const flavor = userFlavor ?? generatedFlavor;

  function handleRegenerate(): void {
    setSeed(generateLocalId());
    setUserFlavor(null);
  }

  function handleFlavorChange(field: keyof NpcFlavor, value: string): void {
    setUserFlavor({ ...flavor, [field]: value });
  }

  const parentChoices = (citizensQuery.data ?? []).filter(
    (citizen) => citizen.status === "alive",
  );

  const namingConfig =
    namesetsQuery.data !== undefined
      ? resolveNamingConfig(
          namesetsQuery.data,
          {
            convention: "random",
            female_given_names: [],
            male_given_names: [],
            surnames: [],
          },
          settlementQuery.data?.namesetId,
          settlementQuery.data?.nation.namesetId,
        )
      : undefined;

  const nameGenerationHint: string | null = (() => {
    if (namingConfig === undefined) return null;
    if (relevantPoolIsEmpty(namingConfig, fields.sex)) {
      return "Given name pool is empty. Add names in world naming settings.";
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
    const result = generateNpcName({
      config: namingConfig,
      rng: createSeededRng(generateLocalId()),
      sex: fields.sex !== "" ? fields.sex : null,
      parentAGivenName: parentA?.givenName ?? null,
      parentASurname: parentA?.surname ?? null,
      parentBGivenName: parentB?.givenName ?? null,
      parentBSurname: parentB?.surname ?? null,
    });
    if (result.givenName !== "") {
      setFields((current) => ({
        ...current,
        givenName: result.givenName,
        surname: result.surname ?? "",
      }));
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();

    const trimmedGivenName = fields.givenName.trim();
    if (trimmedGivenName === "") {
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
          givenName: trimmedGivenName,
          surname: fields.surname.trim() !== "" ? fields.surname.trim() : null,
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <form className="contents" noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create NPC</DialogTitle>
            <DialogDescription>
              NPCs are managed by World Admins and are not linked to a user.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-1 text-sm">
            <Label htmlFor={givenNameId}>Given name</Label>
            <div className="flex gap-2">
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
            </NativeSelect>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <ParentField
              citizens={parentChoices}
              disabled={mutation.isPending || citizensQuery.isPending}
              label="Parent A"
              onChange={(value) => {
                setFields((current) => ({
                  ...current,
                  parentACitizenId: value,
                }));
                setKinshipError(undefined);
              }}
              value={fields.parentACitizenId}
            />

            <ParentField
              citizens={parentChoices}
              disabled={mutation.isPending || citizensQuery.isPending}
              label="Parent B"
              onChange={(value) => {
                setFields((current) => ({
                  ...current,
                  parentBCitizenId: value,
                }));
                setKinshipError(undefined);
              }}
              value={fields.parentBCitizenId}
            />
          </div>

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
              <div className="grid gap-1 text-sm">
                <Label>Trait 1</Label>
                <Input
                  disabled={mutation.isPending}
                  value={flavor.trait1}
                  onChange={(event) =>
                    handleFlavorChange("trait1", event.currentTarget.value)
                  }
                />
              </div>
              <div className="grid gap-1 text-sm">
                <Label>Trait 2</Label>
                <Input
                  disabled={mutation.isPending}
                  value={flavor.trait2}
                  onChange={(event) =>
                    handleFlavorChange("trait2", event.currentTarget.value)
                  }
                />
              </div>
            </div>
            <div className="grid gap-1 text-sm">
              <Label>Secret / contradiction</Label>
              <textarea
                className="min-h-16 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                disabled={mutation.isPending}
                value={flavor.contradiction}
                onChange={(event) =>
                  handleFlavorChange("contradiction", event.currentTarget.value)
                }
              />
            </div>
            <div className="grid gap-1 text-sm">
              <Label>Goal</Label>
              <textarea
                className="min-h-16 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                disabled={mutation.isPending}
                value={flavor.goal}
                onChange={(event) =>
                  handleFlavorChange("goal", event.currentTarget.value)
                }
              />
            </div>
            <div className="grid gap-1 text-sm">
              <Label>Flaw</Label>
              <textarea
                className="min-h-16 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                disabled={mutation.isPending}
                value={flavor.flaw}
                onChange={(event) =>
                  handleFlavorChange("flaw", event.currentTarget.value)
                }
              />
            </div>
          </div>

          {fieldError === undefined ? null : (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {fieldError}
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
              {mutation.isPending ? "Creating…" : "Create NPC"}
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
