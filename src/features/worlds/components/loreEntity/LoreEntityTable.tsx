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

import { EditLoreEntityForm } from "./EditLoreEntityForm";

import type { LoreEntityBase, LoreEntityDescriptor } from "./LoreEntityTypes";

type LoreEntityTableProps<
  TEntity extends LoreEntityBase,
  TCreateInput,
  TUpdateInput,
  TDeleteInput,
  TMutationError,
> = {
  readonly canEdit: boolean;
  readonly descriptor: LoreEntityDescriptor<
    TEntity,
    TCreateInput,
    TUpdateInput,
    TDeleteInput,
    TMutationError
  >;
  readonly entities: readonly TEntity[];
  readonly queryClient: QueryClient;
  readonly worldId: string;
};

// Simple full-list table (no pagination/trash): lore entities are a small,
// admin-curated set per world, unlike the paginated resources config table.
export function LoreEntityTable<
  TEntity extends LoreEntityBase,
  TCreateInput,
  TUpdateInput,
  TDeleteInput,
  TMutationError,
>({
  canEdit,
  descriptor,
  entities,
  queryClient,
  worldId,
}: LoreEntityTableProps<
  TEntity,
  TCreateInput,
  TUpdateInput,
  TDeleteInput,
  TMutationError
>): JSX.Element {
  const [editingEntity, setEditingEntity] = useState<TEntity | null>(null);

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
            {entities.map((entity) => (
              <TableRow key={entity.id}>
                <TableCell>
                  {descriptor.renderDetailLink({
                    children: (
                      <>
                        <span
                          aria-hidden="true"
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: entity.color }}
                        />
                        {entity.name}
                      </>
                    ),
                    className:
                      "inline-flex items-center gap-1.5 font-medium hover:underline",
                    entity,
                  })}
                </TableCell>
                <TableCell
                  className="max-w-xs truncate text-sm text-muted-foreground"
                  title={entity.description ?? undefined}
                >
                  {entity.description ?? ""}
                </TableCell>
                {canEdit ? (
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEditingEntity(entity);
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

      {editingEntity !== null ? (
        <EditLoreEntityForm
          descriptor={descriptor}
          entity={editingEntity}
          queryClient={queryClient}
          worldId={worldId}
          onClose={() => {
            setEditingEntity(null);
          }}
        />
      ) : null}
    </>
  );
}
