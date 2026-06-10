import { useId, useMemo, type JSX } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type TableSkeletonProps = {
  readonly columnCount: number;
  readonly rowCount?: number;
};

export function TableSkeleton({
  columnCount,
  rowCount = 5,
}: TableSkeletonProps): JSX.Element {
  const baseId = useId();
  const columnKeys = useMemo(
    () => Array.from({ length: columnCount }, (_, i) => `${baseId}-col-${i}`),
    [baseId, columnCount],
  );
  const rowKeys = useMemo(
    () => Array.from({ length: rowCount }, (_, i) => `${baseId}-row-${i}`),
    [baseId, rowCount],
  );
  return (
    <div role="status" aria-label="Loading table">
      <Table>
        <TableHeader>
          <TableRow>
            {columnKeys.map((key) => (
              <TableHead key={key}>
                <Skeleton className="h-6 w-24" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rowKeys.map((rowKey) => (
            <TableRow key={rowKey}>
              {columnKeys.map((colKey) => (
                <TableCell key={`${rowKey}-${colKey}`}>
                  <Skeleton className="h-6 w-32" />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

type CardListSkeletonProps = {
  readonly rowCount?: number;
};

export function CardListSkeleton({
  rowCount = 5,
}: CardListSkeletonProps): JSX.Element {
  const baseId = useId();
  const itemKeys = useMemo(
    () => Array.from({ length: rowCount }, (_, i) => `${baseId}-item-${i}`),
    [baseId, rowCount],
  );
  return (
    <div role="status" aria-label="Loading list">
      <div className="grid gap-3">
        {itemKeys.map((key) => (
          <div key={key} className="flex items-center gap-3 p-3">
            <Skeleton className="h-10 w-10 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
