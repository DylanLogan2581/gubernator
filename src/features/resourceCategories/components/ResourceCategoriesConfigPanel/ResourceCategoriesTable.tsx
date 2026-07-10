import { useMutation, type QueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useState, type JSX } from "react";

import { handleCrudError } from "@/components/shared/ConfigCrudPanel";
import { IconChip } from "@/components/shared/IconChip";
import { resolveEntityIcon } from "@/components/shared/iconPicker/CuratedIcons";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { hashToCategoricalSlot } from "@/lib/categoricalPalette";

import { reorderResourceCategoryMutationOptions } from "../../mutations/resourceCategoriesMutations";

import { EditResourceCategoryForm } from "./EditResourceCategoryForm";

import type { ResourceCategory } from "../../types/resourceCategoryTypes";

type ResourceCategoriesTableProps = {
  readonly canEdit: boolean;
  readonly categories: readonly ResourceCategory[];
  readonly queryClient: QueryClient;
  readonly worldId: string;
};

export function ResourceCategoriesTable({
  canEdit,
  categories,
  queryClient,
  worldId,
}: ResourceCategoriesTableProps): JSX.Element {
  const [editingCategory, setEditingCategory] =
    useState<ResourceCategory | null>(null);
  const [pendingCategoryId, setPendingCategoryId] = useState<string | null>(
    null,
  );

  const reorderMutation = useMutation(
    reorderResourceCategoryMutationOptions({ queryClient }),
  );

  function handleMove(
    category: ResourceCategory,
    direction: "up" | "down",
  ): void {
    setPendingCategoryId(category.id);
    reorderMutation.mutate(
      { categoryId: category.id, direction, worldId },
      {
        onError: (error) => {
          setPendingCategoryId(null);
          handleCrudError(error, "Failed to reorder resource category.");
        },
        onSuccess: () => {
          setPendingCategoryId(null);
        },
      },
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              {canEdit ? <TableHead>Order</TableHead> : null}
              {canEdit ? (
                <TableHead className="text-right">Actions</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((category, index) => {
              const isPending = pendingCategoryId === category.id;
              return (
                <TableRow key={category.id}>
                  <TableCell>
                    <span className="inline-flex items-center gap-1.5">
                      <IconChip
                        icon={resolveEntityIcon(category.icon)}
                        tone={hashToCategoricalSlot(category.id)}
                        size="sm"
                      />
                      <span
                        aria-hidden="true"
                        className="size-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="font-medium">{category.name}</span>
                    </span>
                  </TableCell>
                  {canEdit ? (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Move ${category.name} up`}
                          disabled={index === 0 || isPending}
                          onClick={() => {
                            handleMove(category, "up");
                          }}
                        >
                          <ArrowUp aria-hidden="true" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Move ${category.name} down`}
                          disabled={
                            index === categories.length - 1 || isPending
                          }
                          onClick={() => {
                            handleMove(category, "down");
                          }}
                        >
                          <ArrowDown aria-hidden="true" />
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                  {canEdit ? (
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingCategory(category);
                        }}
                      >
                        Edit
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {editingCategory !== null ? (
        <EditResourceCategoryForm
          category={editingCategory}
          queryClient={queryClient}
          worldId={worldId}
          onClose={() => {
            setEditingCategory(null);
          }}
        />
      ) : null}
    </>
  );
}
