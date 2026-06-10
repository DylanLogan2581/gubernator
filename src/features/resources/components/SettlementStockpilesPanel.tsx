import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from "@tanstack/react-query";
import { useState, type FormEvent, type JSX } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { TableSkeleton } from "@/components/shared/SkeletonLoaders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationError, notifyMutationSuccess } from "@/lib/notify";
import { useFieldErrors } from "@/lib/zodFieldErrors";

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
    <Card
      aria-labelledby="settlement-stockpiles-heading"
      className="grid gap-3"
    >
      <h2
        id="settlement-stockpiles-heading"
        className="text-base font-medium px-4 pt-4"
      >
        Stockpiles
      </h2>
      <CardContent>
        {stockpilesQuery.isPending ? (
          <TableSkeleton columnCount={5} rowCount={5} />
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
      </CardContent>
    </Card>
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
      <Table className="w-full text-sm">
        <TableHeader>
          <TableRow>
            <TableHead scope="col">Resource</TableHead>
            <TableHead scope="col" className="tabular-nums">
              Quantity
            </TableHead>
            <TableHead scope="col" className="tabular-nums">
              Cap
            </TableHead>
            <TableHead scope="col" className="w-16" aria-label="Status" />
            <TableHead scope="col" className="w-24" aria-label="Actions" />
          </TableRow>
        </TableHeader>
        <TableBody>
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
        </TableBody>
      </Table>

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
    <TableRow>
      <TableCell className="py-2 pr-4">
        <div className="flex items-center gap-2">
          <span>{stockpile.resourceName}</span>
          {stockpile.isSystemResource ? (
            <Badge variant="secondary">system</Badge>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="py-2 pr-4 tabular-nums">
        {stockpile.quantity.toLocaleString()}
      </TableCell>
      <TableCell className="py-2 pr-4 tabular-nums">
        {stockpile.effectiveCap.toLocaleString()}
      </TableCell>
      <TableCell className="w-16 py-2 pr-2">
        {atCap ? (
          <Badge variant="destructive">at cap</Badge>
        ) : (
          <span className="inline-block w-[53px]" aria-hidden="true" />
        )}
      </TableCell>
      <TableCell className="w-24 py-2 text-right">
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
      </TableCell>
    </TableRow>
  );
}

function EditStockpileDialog({
  onClose,
  queryClient,
  stockpile,
}: {
  readonly onClose: () => void;
  readonly queryClient: QueryClient;
  readonly stockpile: SettlementStockpile;
}): JSX.Element {
  const updateMutation = useMutation(
    updateSettlementStockpileMutationOptions({ queryClient }),
  );
  const [quantity, setQuantity] = useState(String(stockpile.quantity));
  const { fieldErrors, setFromZod, clear } = useFieldErrors<"quantity">();

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    clear();

    const result = updateSettlementStockpileInputSchema.safeParse({
      quantity,
      resourceId: stockpile.resourceId,
      settlementId: stockpile.settlementId,
    });

    if (!result.success) {
      setFromZod(result.error);
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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent>
        <form
          className="contents"
          noValidate
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
        >
          <DialogHeader>
            <DialogTitle>Edit {stockpile.resourceName} quantity</DialogTitle>
            <DialogDescription>
              Update this settlement stockpile quantity.
            </DialogDescription>
          </DialogHeader>
          <Label className="grid gap-1 text-sm" htmlFor="edit-stockpile-qty">
            <span className="text-muted-foreground">Quantity</span>
            <Input
              aria-invalid={fieldErrors.quantity !== undefined}
              aria-label="Quantity"
              autoFocus
              disabled={updateMutation.isPending}
              id="edit-stockpile-qty"
              inputMode="decimal"
              placeholder="0"
              value={quantity}
              onChange={(e) => {
                setQuantity(e.currentTarget.value);
              }}
            />
            {fieldErrors.quantity !== undefined ? (
              <p className="text-xs text-destructive">{fieldErrors.quantity}</p>
            ) : null}
          </Label>
          <DialogFooter>
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
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
