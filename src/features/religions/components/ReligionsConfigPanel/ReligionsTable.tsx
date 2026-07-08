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

import { EditReligionForm } from "./EditReligionForm";

import type { Religion } from "../../types/religionTypes";

type ReligionsTableProps = {
  readonly canEdit: boolean;
  readonly religions: readonly Religion[];
  readonly queryClient: QueryClient;
  readonly worldId: string;
};

// Simple full-list table (no pagination/trash): religions are a small,
// admin-curated set per world, unlike the paginated resources config table.
export function ReligionsTable({
  canEdit,
  religions,
  queryClient,
  worldId,
}: ReligionsTableProps): JSX.Element {
  const [editingReligion, setEditingReligion] = useState<Religion | null>(null);

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
            {religions.map((religion) => (
              <TableRow key={religion.id}>
                <TableCell>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: religion.color }}
                    />
                    <span className="font-medium">{religion.name}</span>
                  </span>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {religion.description ?? ""}
                </TableCell>
                {canEdit ? (
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingReligion(religion);
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

      {editingReligion !== null ? (
        <EditReligionForm
          religion={editingReligion}
          queryClient={queryClient}
          worldId={worldId}
          onClose={() => {
            setEditingReligion(null);
          }}
        />
      ) : null}
    </>
  );
}
