import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { X } from "lucide-react";
import { useId, useState, type FormEvent, type JSX } from "react";

import { DialogShell } from "@/components/shared/DialogShell";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";

import { updateSettlementStockpileMutationOptions } from "../mutations/settlementStockpilesMutations";
import { settlementStockpilesByIdQueryOptions } from "../queries/settlementStockpilesQueries";
import { updateSettlementStockpileInputSchema } from "../schemas/settlementStockpileSchemas";

import type { SettlementStockpile } from "../queries/settlementStockpilesQueries";

type SettlementStockpilesPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly settlementId: string;
};

export function SettlementStockpilesPanel({
  canAdmin,
  isArchived,
  settlementId,
}: SettlementStockpilesPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const stockpilesQuery = useQuery(
    settlementStockpilesByIdQueryOptions(settlementId),
  );

  return (
    <section
      aria-labelledby="settlement-stockpiles-heading"
      className="grid gap-3 rounded-md border border-border bg-card p-4 text-card-foreground"
    >
      <h2 id="settlement-stockpiles-heading" className="text-base font-medium">
        Stockpiles
      </h2>
      {stockpilesQuery.isPending ? (
        <LoadingState label="Loading stockpiles…" />
      ) : stockpilesQuery.isError ? (
        <ErrorState
          title="Stockpiles could not be loaded"
          description={getErrorDescription(stockpilesQuery.error)}
        />
      ) : stockpilesQuery.data.length === 0 ? (
        <EmptyState
          title="No stockpiles"
          description="This settlement has no resource stockpiles."
        />
      ) : (
        <StockpilesTable
          canAdmin={canAdmin}
          isArchived={isArchived}
          queryClient={queryClient}
          stockpiles={sortStockpiles(stockpilesQuery.data)}
        />
      )}
    </section>
  );
}

function sortStockpiles(
  stockpiles: readonly SettlementStockpile[],
): readonly SettlementStockpile[] {
  return [...stockpiles].sort((a, b) => {
    if (a.isSystemResource !== b.isSystemResource) {
      return a.isSystemResource ? -1 : 1;
    }
    return a.resourceName.localeCompare(b.resourceName);
  });
}

function StockpilesTable({
  canAdmin,
  isArchived,
  queryClient,
  stockpiles,
}: {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly queryClient: QueryClient;
  readonly stockpiles: readonly SettlementStockpile[];
}): JSX.Element {
  const [editingStockpile, setEditingStockpile] =
    useState<SettlementStockpile | null>(null);
  const canEdit = canAdmin && !isArchived;

  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left text-muted-foreground">
            <th className="pb-2 font-medium" scope="col">
              Resource
            </th>
            <th className="pb-2 font-medium tabular-nums" scope="col">
              Quantity
            </th>
            <th className="pb-2 font-medium tabular-nums" scope="col">
              Cap
            </th>
            <th className="w-16 pb-2" scope="col" aria-label="Status" />
            <th className="w-24 pb-2" scope="col" aria-label="Actions" />
          </tr>
        </thead>
        <tbody>
          {stockpiles.map((stockpile) => (
            <StockpileRow
              key={stockpile.resourceId}
              canEdit={canEdit}
              stockpile={stockpile}
              onEdit={() => {
                setEditingStockpile(stockpile);
              }}
            />
          ))}
        </tbody>
      </table>

      {editingStockpile !== null ? (
        <EditStockpileDialog
          queryClient={queryClient}
          stockpile={editingStockpile}
          onClose={() => {
            setEditingStockpile(null);
          }}
        />
      ) : null}
    </>
  );
}

function StockpileRow({
  canEdit,
  stockpile,
  onEdit,
}: {
  readonly canEdit: boolean;
  readonly onEdit: () => void;
  readonly stockpile: SettlementStockpile;
}): JSX.Element {
  const atCap = stockpile.quantity >= stockpile.effectiveCap;

  return (
    <tr className="border-b border-border last:border-0">
      <td className="py-2 pr-4">
        <div className="flex items-center gap-2">
          <span>{stockpile.resourceName}</span>
          {stockpile.isSystemResource ? (
            <Badge variant="secondary">system</Badge>
          ) : null}
        </div>
      </td>
      <td className="py-2 pr-4 tabular-nums">
        {stockpile.quantity.toLocaleString()}
      </td>
      <td className="py-2 pr-4 tabular-nums">
        {stockpile.effectiveCap.toLocaleString()}
      </td>
      <td className="w-16 py-2 pr-2">
        {atCap ? (
          <Badge variant="destructive">at cap</Badge>
        ) : (
          <span className="inline-block w-[53px]" aria-hidden="true" />
        )}
      </td>
      <td className="w-24 py-2 text-right">
        {canEdit ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Edit ${stockpile.resourceName} quantity`}
            onClick={onEdit}
          >
            Edit
          </Button>
        ) : (
          <Badge variant="secondary">read-only</Badge>
        )}
      </td>
    </tr>
  );
}

type QuantityFieldError = string | undefined;

function EditStockpileDialog({
  onClose,
  queryClient,
  stockpile,
}: {
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly stockpile: SettlementStockpile;
}): JSX.Element {
  const titleId = useId();
  const updateMutation = useMutation(
    updateSettlementStockpileMutationOptions({ queryClient }),
  );
  const [quantity, setQuantity] = useState(String(stockpile.quantity));
  const [fieldError, setFieldError] = useState<QuantityFieldError>(undefined);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    setFieldError(undefined);

    const result = updateSettlementStockpileInputSchema.safeParse({
      quantity,
      resourceId: stockpile.resourceId,
      settlementId: stockpile.settlementId,
    });

    if (!result.success) {
      for (const issue of result.error.issues) {
        if (issue.path[0] === "quantity") {
          setFieldError(issue.message);
          return;
        }
      }
      setFieldError("Invalid input.");
      return;
    }

    try {
      await updateMutation.mutateAsync({
        quantity,
        resourceId: stockpile.resourceId,
        settlementId: stockpile.settlementId,
      });
      notifyMutationSuccess("Stockpile updated.");
      onClose();
    } catch (error) {
      notifyMutationError(error, "Failed to update stockpile.");
    }
  }

  return (
    <DialogShell>
      <form
        aria-labelledby={titleId}
        aria-modal="true"
        className="grid w-full max-w-sm gap-4 rounded-md border border-border bg-card p-5 text-card-foreground shadow-lg"
        noValidate
        role="dialog"
        onSubmit={(e) => {
          void handleSubmit(e);
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 id={titleId} className="text-lg font-semibold">
            Edit {stockpile.resourceName} quantity
          </h3>
          <Button
            aria-label={`Cancel edit ${stockpile.resourceName} quantity`}
            disabled={updateMutation.isPending}
            onClick={onClose}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <label className="grid gap-1 text-sm">
          <span className="text-muted-foreground">Quantity</span>
          <Input
            aria-invalid={fieldError !== undefined}
            aria-label="Quantity"
            autoFocus
            disabled={updateMutation.isPending}
            inputMode="decimal"
            placeholder="0"
            value={quantity}
            onChange={(e) => {
              setQuantity(e.currentTarget.value);
            }}
          />
          {fieldError !== undefined ? (
            <p className="text-xs text-destructive">{fieldError}</p>
          ) : null}
        </label>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            disabled={updateMutation.isPending}
            onClick={onClose}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button disabled={updateMutation.isPending} type="submit">
            Save
          </Button>
        </div>
      </form>
    </DialogShell>
  );
}
