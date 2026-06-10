import { type JSX } from "react";

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
  return (
    <div role="status" aria-label="Loading table">
      <Table>
        <TableHeader>
          <TableRow>
            {Array.from({ length: columnCount }).map((_, i) => (
              <TableHead key={`header-${i}`}>
                <Skeleton className="h-6 w-24" />
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: rowCount }).map((_, rowIdx) => (
            <TableRow key={`row-${rowIdx}`}>
              {Array.from({ length: columnCount }).map((_, colIdx) => (
                <TableCell key={`cell-${rowIdx}-${colIdx}`}>
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
  return (
    <div role="status" aria-label="Loading list">
      <div className="grid gap-3">
        {Array.from({ length: rowCount }).map((_, i) => (
          <div key={`item-${i}`} className="flex items-center gap-3 p-3">
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
