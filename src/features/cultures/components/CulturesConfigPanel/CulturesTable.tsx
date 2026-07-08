import { type QueryClient } from "@tanstack/react-query";
import { useState, type JSX } from "react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { EditCultureForm } from "./EditCultureForm";

import type { Culture } from "../../types/cultureTypes";

type CulturesTableProps = {
  readonly canEdit: boolean;
  readonly cultures: readonly Culture[];
  readonly queryClient: QueryClient;
  readonly worldId: string;
};

// Simple full-list table (no pagination/trash): cultures are a small,
// admin-curated set per world, unlike the paginated resources config table.
export function CulturesTable({
  canEdit,
  cultures,
  queryClient,
  worldId,
}: CulturesTableProps): JSX.Element {
  const [editingCulture, setEditingCulture] = useState<Culture | null>(null);

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Description</TableHead>
              {canEdit ? (
                <TableHead className="text-right">Actions</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {cultures.map((culture) => (
              <TableRow key={culture.id}>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: culture.color }}
                    />
                    <span className="font-medium">{culture.name}</span>
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {culture.description ?? ""}
                </TableCell>
                {canEdit ? (
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingCulture(culture);
                      }}
                    >
                      Edit
                    </Button>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editingCulture !== null ? (
        <EditCultureForm
          culture={editingCulture}
          queryClient={queryClient}
          worldId={worldId}
          onClose={() => {
            setEditingCulture(null);
          }}
        />
      ) : null}
    </>
  );
}
