import { useMutation, useQuery, type QueryClient } from "@tanstack/react-query";
import { useState, type FormEvent, type JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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

import { proposeTradeRouteMutationOptions } from "../../mutations/proposeTradeRouteMutations";

type RouteFormValues = {
  destinationSettlementId: string;
  originSettlementId: string;
  quantityPerTransition: string;
  resourceId: string;
};

type ProposeTradeRouteDialogProps = {
  readonly activeCharacterId: string;
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly settlementId: string;
  readonly worldId: string;
};

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

  const [form, setForm] = useState<RouteFormValues>({
    destinationSettlementId: "",
    originSettlementId: settlementId,
    quantityPerTransition: "",
    resourceId: "",
  });
  const [errors, setErrors] = useState<
    Partial<Record<keyof RouteFormValues, string>>
  >({});

  const settlements = (settlementsQuery.data ?? []).filter(
    (s) => s.id !== settlementId,
  );
  const resources = resourcesQuery.data ?? [];

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const newErrors: Partial<Record<keyof RouteFormValues, string>> = {};

    if (form.destinationSettlementId === "") {
      newErrors.destinationSettlementId = "Select a destination settlement.";
    }
    if (form.resourceId === "") {
      newErrors.resourceId = "Select a resource.";
    }
    const qty = parseFloat(form.quantityPerTransition);
    if (form.quantityPerTransition === "" || Number.isNaN(qty) || qty <= 0) {
      newErrors.quantityPerTransition = "Quantity must be greater than zero.";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    mutation.mutate(
      {
        destinationSettlementId: form.destinationSettlementId,
        originSettlementId: form.originSettlementId,
        proposingCitizenId: activeCharacterId,
        quantityPerTransition: qty,
        resourceId: form.resourceId,
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
                  value={form.destinationSettlementId}
                  onChange={(e) => {
                    const val = e.currentTarget.value;
                    setForm((prev) => ({
                      ...prev,
                      destinationSettlementId: val,
                    }));
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
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Resource</span>
              {resources.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  No active resources available.
                </span>
              ) : (
                <NativeSelect
                  aria-invalid={errors.resourceId !== undefined}
                  aria-label="Resource"
                  className="w-full"
                  disabled={mutation.isPending}
                  value={form.resourceId}
                  onChange={(e) => {
                    const val = e.currentTarget.value;
                    setForm((prev) => ({
                      ...prev,
                      resourceId: val,
                    }));
                  }}
                >
                  <option value="">Select a resource…</option>
                  {sortByName(resources).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
              {errors.resourceId !== undefined ? (
                <p className="text-xs text-destructive">{errors.resourceId}</p>
              ) : null}
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground">Quantity per turn</span>
              <Input
                aria-invalid={errors.quantityPerTransition !== undefined}
                aria-label="Quantity per turn"
                disabled={mutation.isPending}
                inputMode="numeric"
                placeholder="e.g. 10"
                value={form.quantityPerTransition}
                onChange={(e) => {
                  const val = e.currentTarget.value;
                  setForm((prev) => ({
                    ...prev,
                    quantityPerTransition: val,
                  }));
                }}
              />
              {errors.quantityPerTransition !== undefined ? (
                <p className="text-xs text-destructive">
                  {errors.quantityPerTransition}
                </p>
              ) : null}
            </label>
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
