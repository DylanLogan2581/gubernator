import { type JSX } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import { discoveryPairKey } from "./NationDiscoveryUtils";

import type { Nation, NationDiscoveryPair } from "../../types/nationTypes";

type NationDiscoveryGridProps = {
  readonly canEdit: boolean;
  readonly nations: readonly Nation[];
  readonly pairsByKey: ReadonlyMap<string, NationDiscoveryPair>;
  readonly pendingKey: string | null;
  readonly onToggle: (nationA: Nation, nationB: Nation, met: boolean) => void;
};

// Upper-triangle matrix: only cells where the column nation sorts after the
// row nation are rendered, so each unordered pair gets exactly one checkbox.
export function NationDiscoveryGrid({
  canEdit,
  nations,
  pairsByKey,
  pendingKey,
  onToggle,
}: NationDiscoveryGridProps): JSX.Element {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="sticky left-0 bg-card">Nation</TableHead>
          {nations.map((column) => (
            <TableHead key={column.id} className="text-center">
              {column.name}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {nations.map((row, rowIndex) => (
          <TableRow key={row.id}>
            <TableCell className="sticky left-0 bg-card font-medium">
              {row.name}
            </TableCell>
            {nations.map((column, columnIndex) => {
              if (columnIndex <= rowIndex) {
                return <TableCell key={column.id} />;
              }

              const key = discoveryPairKey(row.id, column.id);
              const pair = pairsByKey.get(key);
              const met = pair !== undefined;
              const isPending = pendingKey === key;

              const checkbox = (
                <Checkbox
                  aria-label={`${row.name} has met ${column.name}`}
                  checked={met}
                  disabled={!canEdit || isPending}
                  onCheckedChange={() => {
                    onToggle(row, column, !met);
                  }}
                />
              );

              return (
                <TableCell key={column.id} className="text-center">
                  {met ? (
                    <Tooltip>
                      <TooltipTrigger asChild>{checkbox}</TooltipTrigger>
                      <TooltipContent>
                        Met at turn {pair.metAtTurnNumber}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    checkbox
                  )}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
