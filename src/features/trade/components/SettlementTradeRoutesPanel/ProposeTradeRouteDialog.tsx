import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent, type JSX } from "react";

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
import { NativeSelect } from "@/components/ui/native-select";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { settlementsByWorldQueryOptions } from "@/features/settlements";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import { sortByName } from "@/lib/sortUtils";
import { generateLocalId } from "@/lib/uid";

import { proposeTradeRouteMutationOptions } from "../../mutations/proposeTradeRouteMutations";

type LegDraft = {
  direction: "send" | "receive";
  id: string;
  quantity: string;
  resourceId: string;
};

type LegErrors = {
  direction?: string;
  quantity?: string;
  resourceId?: string;
};

type FormErrors = {
  destinationSettlementId?: string;
  legs?: LegErrors[];
};

type ProposeTradeRouteDialogProps = {
  readonly activeCharacterId: string;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly worldId: string;
};

function createLegDraft(
  overrides: Partial<Omit<LegDraft, "id">> = {},
): LegDraft {
  return {
    direction: "send",
    id: generateLocalId(),
    quantity: "",
    resourceId: "",
    ...overrides,
  };
}

export function ProposeTradeRouteDialog({
  activeCharacterId,
  onClose,
  queryClient,
  settlementId,
  worldId,
}: ProposeTradeRouteDialogProps): JSX.Element {
  const settlementsQuery = useQuery(settlementsByWorldQueryOptions(worldId));
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));
  const mutation = useMutation(
    proposeTradeRouteMutationOptions({ queryClient }),
  );

  const [destinationSettlementId, setDestinationSettlementId] = useState("");
  const [legs, setLegs] = useState<LegDraft[]>(() => [createLegDraft()]);
  const [errors, setErrors] = useState<FormErrors>({});

  const settlements = (settlementsQuery.data ?? []).filter(
    (s) => s.id !== settlementId,
  );
  const resources = resourcesQuery.data ?? [];

  function addLeg(): void {
    setLegs((prev) => [...prev, createLegDraft()]);
  }

  function removeLeg(index: number): void {
    setLegs((prev) => prev.filter((_, i) => i !== index));
  }

  function updateLeg(index: number, patch: Partial<LegDraft>): void {
    setLegs((prev) =>
      prev.map((leg, i) => (i === index ? { ...leg, ...patch } : leg)),
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const newErrors: FormErrors = {};

    if (destinationSettlementId === "") {
      newErrors.destinationSettlementId = "Select a destination settlement.";
    }

    const legErrors: LegErrors[] = legs.map((leg) => {
      const errs: LegErrors = {};
      if (leg.resourceId === "") errs.resourceId = "Select a resource.";
      const qty = parseFloat(leg.quantity);
      if (leg.quantity === "" || Number.isNaN(qty) || qty <= 0) {
        errs.quantity = "Quantity must be greater than zero.";
      }
      return errs;
    });

    if (legErrors.some((e) => Object.keys(e).length > 0)) {
      newErrors.legs = legErrors;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    mutation.mutate(
      {
        destinationSettlementId,
        legs: legs.map((leg) => ({
          direction: leg.direction,
          quantity: parseFloat(leg.quantity),
          resourceId: leg.resourceId,
        })),
        originSettlementId: settlementId,
        proposingCitizenId: activeCharacterId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to propose trade route.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Trade route proposed.");
          onClose();
        },
      },
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <form className="contents" noValidate onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Propose trade route</DialogTitle>
            <DialogDescription className="sr-only">
              Choose a destination settlement and resource legs for a proposed
              trade route.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">
                Destination settlement
              </span>
              {settlementsQuery.isPending ? (
                <span className="text-xs text-muted-foreground">
                  Loading settlements…
                </span>
              ) : settlements.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  No other settlements available.
                </span>
              ) : (
                <NativeSelect
                  aria-invalid={errors.destinationSettlementId !== undefined}
                  aria-label="Destination settlement"
                  className="w-full"
                  disabled={mutation.isPending}
                  value={destinationSettlementId}
                  onChange={(e) => {
                    setDestinationSettlementId(e.currentTarget.value);
                  }}
                >
                  <option value="">Select a settlement…</option>
                  {sortByName(settlements).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.nationName})
                    </option>
                  ))}
                </NativeSelect>
              )}
              {errors.destinationSettlementId !== undefined ? (
                <p className="text-xs text-destructive">
                  {errors.destinationSettlementId}
                </p>
              ) : null}
            </label>

            <div className="grid gap-2">
              <span className="text-sm text-muted-foreground">Resources</span>
              {legs.map((leg, index) => (
                <LegRow
                  key={leg.id}
                  disabled={mutation.isPending}
                  errors={errors.legs?.[index]}
                  index={index}
                  leg={leg}
                  resources={resources}
                  showRemove={legs.length > 1}
                  onRemove={() => {
                    removeLeg(index);
                  }}
                  onUpdate={(patch) => {
                    updateLeg(index, patch);
                  }}
                />
              ))}
              <Button
                disabled={mutation.isPending}
                size="sm"
                type="button"
                variant="outline"
                onClick={addLeg}
              >
                <Plus aria-hidden="true" />
                Add resource
              </Button>
            </div>
          </div>
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
              Propose
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function LegRow({
  disabled,
  errors,
  index,
  leg,
  resources,
  showRemove,
  onRemove,
  onUpdate,
}: {
  readonly disabled: boolean;
  readonly errors: LegErrors | undefined;
  readonly index: number;
  readonly leg: LegDraft;
  readonly resources: readonly { readonly id: string; readonly name: string }[];
  readonly showRemove: boolean;
  readonly onRemove: () => void;
  readonly onUpdate: (patch: Partial<LegDraft>) => void;
}): JSX.Element {
  return (
    <div className="grid gap-2 rounded-md border border-border p-3">
      <div className="flex items-center gap-2">
        <NativeSelect
          aria-label={`Leg ${String(index + 1)} direction`}
          className="w-28 shrink-0"
          disabled={disabled}
          value={leg.direction}
          onChange={(e) => {
            onUpdate({
              direction: e.currentTarget.value as "send" | "receive",
            });
          }}
        >
          <option value="send">Send (−)</option>
          <option value="receive">Receive (+)</option>
        </NativeSelect>
        <div className="flex-1">
          <NativeSelect
            aria-invalid={errors?.resourceId !== undefined}
            aria-label={`Leg ${String(index + 1)} resource`}
            className="w-full"
            disabled={disabled}
            value={leg.resourceId}
            onChange={(e) => {
              onUpdate({ resourceId: e.currentTarget.value });
            }}
          >
            <option value="">Select a resource…</option>
            {sortByName(resources).map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </NativeSelect>
          {errors?.resourceId !== undefined ? (
            <p className="mt-0.5 text-xs text-destructive">
              {errors.resourceId}
            </p>
          ) : null}
        </div>
        <div className="w-24 shrink-0">
          <Input
            aria-invalid={errors?.quantity !== undefined}
            aria-label={`Leg ${String(index + 1)} quantity per turn`}
            disabled={disabled}
            inputMode="numeric"
            placeholder="Qty"
            value={leg.quantity}
            onChange={(e) => {
              onUpdate({ quantity: e.currentTarget.value });
            }}
          />
          {errors?.quantity !== undefined ? (
            <p className="mt-0.5 text-xs text-destructive">{errors.quantity}</p>
          ) : null}
        </div>
        {showRemove ? (
          <Button
            aria-label={`Remove leg ${String(index + 1)}`}
            disabled={disabled}
            size="sm"
            type="button"
            variant="ghost"
            onClick={onRemove}
          >
            <Trash2 aria-hidden="true" className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
