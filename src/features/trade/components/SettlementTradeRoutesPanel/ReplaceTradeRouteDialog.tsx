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
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import { sortByName } from "@/lib/sortUtils";
import { generateLocalId } from "@/lib/uid";

import { replaceTradeRouteMutationOptions } from "../../mutations/replaceTradeRouteMutations";

import type { TradeRoute } from "../../types/tradeRouteTypes";

type LegDraft = {
  direction: "send" | "receive";
  id: string;
  quantity: string;
  resourceId: string;
};

type LegErrors = {
  quantity?: string;
  resourceId?: string;
};

type ReplaceTradeRouteDialogProps = {
  readonly activeCharacterId: string;
  readonly counterpart: string;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly route: TradeRoute;
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

export function ReplaceTradeRouteDialog({
  activeCharacterId,
  counterpart,
  onClose,
  queryClient,
  route,
  worldId,
}: ReplaceTradeRouteDialogProps): JSX.Element {
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));
  const mutation = useMutation(
    replaceTradeRouteMutationOptions({ queryClient }),
  );

  const [legs, setLegs] = useState<LegDraft[]>(() =>
    route.legs.length > 0
      ? route.legs.map((l) =>
          createLegDraft({
            direction: l.direction,
            quantity: String(l.quantityPerTransition),
            resourceId: l.resourceId,
          }),
        )
      : [createLegDraft()],
  );
  const [legErrors, setLegErrors] = useState<LegErrors[]>([]);

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
    setLegErrors([]);

    const errs: LegErrors[] = legs.map((leg) => {
      const e: LegErrors = {};
      if (leg.resourceId === "") e.resourceId = "Select a resource.";
      const qty = parseFloat(leg.quantity);
      if (leg.quantity === "" || Number.isNaN(qty) || qty <= 0) {
        e.quantity = "Quantity must be greater than zero.";
      }
      return e;
    });

    if (errs.some((e) => Object.keys(e).length > 0)) {
      setLegErrors(errs);
      return;
    }

    mutation.mutate(
      {
        newRoutePayload: {
          destinationSettlementId: route.destinationSettlementId,
          legs: legs.map((leg) => ({
            direction: leg.direction,
            quantity: parseFloat(leg.quantity),
            resourceId: leg.resourceId,
          })),
          originSettlementId: route.originSettlementId,
        },
        oldRouteId: route.id,
        proposingCitizenId: activeCharacterId,
      },
      {
        onError: (error) => {
          notifyMutationError(error, "Failed to replace trade route.");
        },
        onSuccess: () => {
          notifyMutationSuccess(
            "Trade route replaced. New proposal pending approval.",
          );
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
            <DialogTitle>Replace trade route</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Replace the route with{" "}
            <span className="font-medium text-foreground">{counterpart}</span>.
            A new proposal will be created pending approval.
          </DialogDescription>
          <div className="grid gap-2">
            <span className="text-sm text-muted-foreground">Resources</span>
            {legs.map((leg, index) => (
              <LegRow
                key={leg.id}
                disabled={mutation.isPending}
                errors={legErrors[index]}
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
              Replace
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
