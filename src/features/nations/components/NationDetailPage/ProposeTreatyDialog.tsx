import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { useState, type JSX } from "react";

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
import { citizensDirectoryQueryOptions } from "@/features/citizens";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import { sortByName } from "@/lib/sortUtils";

import { proposeTreatyMutationOptions } from "../../mutations/treatiesMutations";
import { formatNationTreatyType } from "../../types/nationTreatyTypes";

import type { ProposeTreatyInput } from "../../schemas/treatiesSchemas";
import type { NationTreatyType } from "../../types/nationTreatyTypes";
import type { Nation } from "../../types/nationTypes";

// currency_exchange stays hidden — propose_nation_treaty rejects it outright
// until a currencies table exists (see #1089 migration notes), so offering
// it here would only surface a confusing RPC error after submit.
const PROPOSABLE_TREATY_TYPES: readonly NationTreatyType[] = [
  "tribute",
  "trade_agreement",
  "royal_marriage",
];

type FormErrors = {
  citizenAId?: string;
  citizenBId?: string;
  quantityPerTurn?: string;
  resourceId?: string;
};

export function ProposeTreatyDialog({
  activeCharacterId,
  nation,
  onClose,
  other,
  queryClient,
}: {
  readonly activeCharacterId: string;
  readonly nation: Nation;
  readonly onClose: () => void;
  readonly other: Nation;
  readonly queryClient: QueryClient;
}): JSX.Element {
  const [treatyType, setTreatyType] = useState<NationTreatyType>("tribute");
  const [payer, setPayer] = useState<"proposer" | "responder">("proposer");
  const [resourceId, setResourceId] = useState("");
  const [quantityPerTurn, setQuantityPerTurn] = useState("");
  const [citizenAId, setCitizenAId] = useState("");
  const [citizenBId, setCitizenBId] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  const resourcesQuery = useQuery(
    activeResourcesByWorldQueryOptions(nation.worldId),
  );
  const nationCitizensQuery = useQuery(
    citizensDirectoryQueryOptions(
      nation.worldId,
      { nationId: nation.id, status: "alive" },
      { pageIndex: 0, pageSize: 200 },
    ),
  );
  const otherCitizensQuery = useQuery(
    citizensDirectoryQueryOptions(
      nation.worldId,
      { nationId: other.id, status: "alive" },
      { pageIndex: 0, pageSize: 200 },
    ),
  );
  const mutation = useMutation(proposeTreatyMutationOptions({ queryClient }));

  const resources = resourcesQuery.data ?? [];
  const nationCitizens = nationCitizensQuery.data?.rows ?? [];
  const otherCitizens = otherCitizensQuery.data?.rows ?? [];

  function handleSubmit(): void {
    const newErrors: FormErrors = {};

    if (treatyType === "tribute") {
      if (resourceId === "") newErrors.resourceId = "Select a resource.";
      const qty = parseFloat(quantityPerTurn);
      if (quantityPerTurn === "" || Number.isNaN(qty) || qty <= 0) {
        newErrors.quantityPerTurn =
          "Quantity per turn must be greater than zero.";
      }
    } else if (treatyType === "royal_marriage") {
      if (citizenAId === "")
        newErrors.citizenAId = `Select a citizen of ${nation.name}.`;
      if (citizenBId === "")
        newErrors.citizenBId = `Select a citizen of ${other.name}.`;
      if (citizenAId !== "" && citizenBId !== "" && citizenAId === citizenBId) {
        newErrors.citizenBId = "Select two distinct citizens.";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const input: ProposeTreatyInput =
      treatyType === "tribute"
        ? {
            proposedByCitizenId: activeCharacterId,
            proposerNationId: nation.id,
            responderNationId: other.id,
            terms: {
              payer,
              quantityPerTurn: parseFloat(quantityPerTurn),
              resourceId,
            },
            treatyType: "tribute",
          }
        : treatyType === "royal_marriage"
          ? {
              proposedByCitizenId: activeCharacterId,
              proposerNationId: nation.id,
              responderNationId: other.id,
              terms: { citizenAId, citizenBId },
              treatyType: "royal_marriage",
            }
          : {
              proposedByCitizenId: activeCharacterId,
              proposerNationId: nation.id,
              responderNationId: other.id,
              terms: {},
              treatyType: "trade_agreement",
            };

    mutation.mutate(input, {
      onError: (error) => {
        notifyMutationError(error, "Failed to propose treaty.");
      },
      onSuccess: () => {
        notifyMutationSuccess(`Treaty proposed to ${other.name}.`);
        onClose();
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
          <DialogTitle>Propose treaty</DialogTitle>
          <DialogDescription>
            Propose a treaty between {nation.name} and {other.name}.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Label className="grid gap-1 text-sm">
            <span className="text-muted-foreground">Treaty type</span>
            <NativeSelect
              aria-label="Treaty type"
              disabled={mutation.isPending}
              value={treatyType}
              onChange={(event) => {
                setTreatyType(event.currentTarget.value as NationTreatyType);
                setErrors({});
              }}
            >
              {PROPOSABLE_TREATY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {formatNationTreatyType(type)}
                </option>
              ))}
            </NativeSelect>
          </Label>

          {treatyType === "tribute" ? (
            <div className="grid gap-2">
              <Label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Payer</span>
                <NativeSelect
                  aria-label="Payer"
                  disabled={mutation.isPending}
                  value={payer}
                  onChange={(event) => {
                    setPayer(
                      event.currentTarget.value as "proposer" | "responder",
                    );
                  }}
                >
                  <option value="proposer">{nation.name}</option>
                  <option value="responder">{other.name}</option>
                </NativeSelect>
              </Label>
              <Label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Resource</span>
                {resourcesQuery.isPending ? (
                  <span className="text-xs text-muted-foreground">
                    Loading resources…
                  </span>
                ) : (
                  <NativeSelect
                    aria-invalid={errors.resourceId !== undefined}
                    aria-label="Resource"
                    disabled={mutation.isPending}
                    value={resourceId}
                    onChange={(event) => {
                      setResourceId(event.currentTarget.value);
                    }}
                  >
                    <option value="">Select a resource…</option>
                    {sortByName(resources).map((resource) => (
                      <option key={resource.id} value={resource.id}>
                        {resource.name}
                      </option>
                    ))}
                  </NativeSelect>
                )}
                {errors.resourceId !== undefined ? (
                  <p className="text-xs text-destructive">
                    {errors.resourceId}
                  </p>
                ) : null}
              </Label>
              <Label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">Quantity per turn</span>
                <Input
                  aria-invalid={errors.quantityPerTurn !== undefined}
                  aria-label="Quantity per turn"
                  disabled={mutation.isPending}
                  inputMode="numeric"
                  value={quantityPerTurn}
                  onChange={(event) => {
                    setQuantityPerTurn(event.currentTarget.value);
                  }}
                />
                {errors.quantityPerTurn !== undefined ? (
                  <p className="text-xs text-destructive">
                    {errors.quantityPerTurn}
                  </p>
                ) : null}
              </Label>
            </div>
          ) : null}

          {treatyType === "royal_marriage" ? (
            <div className="grid gap-2">
              <Label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">
                  {nation.name} citizen
                </span>
                {nationCitizensQuery.isPending ? (
                  <span className="text-xs text-muted-foreground">
                    Loading citizens…
                  </span>
                ) : (
                  <NativeSelect
                    aria-invalid={errors.citizenAId !== undefined}
                    aria-label={`${nation.name} citizen`}
                    disabled={mutation.isPending}
                    value={citizenAId}
                    onChange={(event) => {
                      setCitizenAId(event.currentTarget.value);
                    }}
                  >
                    <option value="">Select a citizen…</option>
                    {nationCitizens.map((citizen) => (
                      <option key={citizen.id} value={citizen.id}>
                        {citizen.name}
                      </option>
                    ))}
                  </NativeSelect>
                )}
                {errors.citizenAId !== undefined ? (
                  <p className="text-xs text-destructive">
                    {errors.citizenAId}
                  </p>
                ) : null}
              </Label>
              <Label className="grid gap-1 text-sm">
                <span className="text-muted-foreground">
                  {other.name} citizen
                </span>
                {otherCitizensQuery.isPending ? (
                  <span className="text-xs text-muted-foreground">
                    Loading citizens…
                  </span>
                ) : (
                  <NativeSelect
                    aria-invalid={errors.citizenBId !== undefined}
                    aria-label={`${other.name} citizen`}
                    disabled={mutation.isPending}
                    value={citizenBId}
                    onChange={(event) => {
                      setCitizenBId(event.currentTarget.value);
                    }}
                  >
                    <option value="">Select a citizen…</option>
                    {otherCitizens.map((citizen) => (
                      <option key={citizen.id} value={citizen.id}>
                        {citizen.name}
                      </option>
                    ))}
                  </NativeSelect>
                )}
                {errors.citizenBId !== undefined ? (
                  <p className="text-xs text-destructive">
                    {errors.citizenBId}
                  </p>
                ) : null}
              </Label>
            </div>
          ) : null}

          {treatyType === "trade_agreement" ? (
            <p className="text-sm text-muted-foreground">
              A trade agreement carries no additional terms.
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            disabled={mutation.isPending}
            type="button"
            variant="outline"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            disabled={mutation.isPending}
            type="button"
            onClick={handleSubmit}
          >
            {mutation.isPending ? "Proposing…" : "Propose"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
