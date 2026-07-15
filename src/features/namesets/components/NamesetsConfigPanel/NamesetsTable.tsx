import { useMutation, type QueryClient } from "@tanstack/react-query";
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  RotateCcw,
  Star,
  Trash2,
} from "lucide-react";
import { useMemo, useState, type JSX, type ReactNode } from "react";

import { handleCrudError } from "@/components/shared/ConfigCrudPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { notifyMutationSuccess } from "@/lib/notify";
import { cn } from "@/lib/utils";
import type { NameConvention } from "@/lib/worldNamingConfigSchemas";

import {
  hardDeleteNamesetMutationOptions,
  restoreNamesetMutationOptions,
  setDefaultNamesetMutationOptions,
  softDeleteNamesetMutationOptions,
} from "../../mutations/namesetsMutations";

import { EditNamesetForm } from "./NamesetForm";

import type { Nameset } from "../../types/namesetTypes";

const CONVENTION_LABELS: Record<NameConvention, string> = {
  pool: "Pool",
  patronymic: "Patronymic",
  matronymic: "Matronymic",
  "family-name": "Family name",
  none: "None",
};

type SortColumn = "convention" | "givenNames" | "name" | "surnames";
type Sort = { readonly column: SortColumn; readonly desc: boolean };

function givenNamesCount(nameset: Nameset): number {
  return (
    nameset.configJson.male_given_names.length +
    nameset.configJson.female_given_names.length
  );
}

function sortNamesets(
  namesets: readonly Nameset[],
  sort: Sort | null,
): readonly Nameset[] {
  if (sort === null) return namesets;

  const direction = sort.desc ? -1 : 1;
  return [...namesets].sort((a, b) => {
    switch (sort.column) {
      case "name":
        return a.name.localeCompare(b.name) * direction;
      case "convention":
        return (
          CONVENTION_LABELS[a.configJson.convention].localeCompare(
            CONVENTION_LABELS[b.configJson.convention],
          ) * direction
        );
      case "givenNames":
        return (givenNamesCount(a) - givenNamesCount(b)) * direction;
      case "surnames":
        return (
          (a.configJson.surnames.length - b.configJson.surnames.length) *
          direction
        );
    }
  });
}

function SortIndicator({
  direction,
}: {
  readonly direction: false | "asc" | "desc";
}): JSX.Element {
  if (direction === "asc") {
    return <ArrowUpIcon aria-hidden="true" className="size-3.5" />;
  }
  if (direction === "desc") {
    return <ArrowDownIcon aria-hidden="true" className="size-3.5" />;
  }
  return (
    <ArrowUpDownIcon
      aria-hidden="true"
      className="size-3.5 text-muted-foreground/50"
    />
  );
}

function ariaSortFor(
  direction: false | "asc" | "desc",
): JSX.IntrinsicElements["th"]["aria-sort"] {
  if (direction === "asc") return "ascending";
  if (direction === "desc") return "descending";
  return "none";
}

function SortableHead({
  align,
  children,
  column,
  sort,
  onSortChange,
}: {
  readonly align?: "right";
  readonly children: ReactNode;
  readonly column: SortColumn;
  readonly onSortChange: (sort: Sort) => void;
  readonly sort: Sort | null;
}): JSX.Element {
  const direction: false | "asc" | "desc" =
    sort?.column === column ? (sort.desc ? "desc" : "asc") : false;

  return (
    <TableHead
      aria-sort={ariaSortFor(direction)}
      className={align === "right" ? "text-right" : undefined}
    >
      <button
        type="button"
        className={cn(
          "flex items-center gap-1 rounded-sm outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50",
          align === "right" && "ml-auto",
        )}
        onClick={() => {
          onSortChange({
            column,
            desc: sort?.column === column && !sort.desc,
          });
        }}
      >
        {children}
        <SortIndicator direction={direction} />
      </button>
    </TableHead>
  );
}

export function NamesetsTable({
  canEdit,
  namesets,
  queryClient,
  showTrash,
  worldId,
}: {
  readonly canEdit: boolean;
  readonly namesets: readonly Nameset[];
  readonly queryClient: QueryClient;
  readonly showTrash: boolean;
  readonly worldId: string;
}): JSX.Element {
  const [sort, setSort] = useState<Sort | null>(null);
  const [editingNameset, setEditingNameset] = useState<Nameset | null>(null);

  const sortedNamesets = useMemo(
    () => sortNamesets(namesets, sort),
    [namesets, sort],
  );

  return (
    <>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead column="name" sort={sort} onSortChange={setSort}>
                Name
              </SortableHead>
              <SortableHead
                column="convention"
                sort={sort}
                onSortChange={setSort}
              >
                Type
              </SortableHead>
              <SortableHead
                align="right"
                column="givenNames"
                sort={sort}
                onSortChange={setSort}
              >
                Given names
              </SortableHead>
              <SortableHead
                align="right"
                column="surnames"
                sort={sort}
                onSortChange={setSort}
              >
                Surnames
              </SortableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedNamesets.map((nameset) =>
              showTrash ? (
                <TrashedNamesetRow
                  key={nameset.id}
                  nameset={nameset}
                  queryClient={queryClient}
                  worldId={worldId}
                />
              ) : (
                <NamesetRow
                  key={nameset.id}
                  canEdit={canEdit}
                  nameset={nameset}
                  queryClient={queryClient}
                  worldId={worldId}
                  onEdit={() => {
                    setEditingNameset(nameset);
                  }}
                />
              ),
            )}
          </TableBody>
        </Table>
      </div>

      {editingNameset !== null ? (
        <EditNamesetForm
          nameset={editingNameset}
          queryClient={queryClient}
          worldId={worldId}
          onClose={() => {
            setEditingNameset(null);
          }}
        />
      ) : null}
    </>
  );
}

function NamesetRow({
  canEdit,
  nameset,
  queryClient,
  worldId,
  onEdit,
}: {
  readonly canEdit: boolean;
  readonly nameset: Nameset;
  readonly onEdit: () => void;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const softDeleteMutation = useMutation(
    softDeleteNamesetMutationOptions({ queryClient }),
  );
  const setDefaultMutation = useMutation(
    setDefaultNamesetMutationOptions({ queryClient }),
  );

  function handleTrash(): void {
    softDeleteMutation.mutate(
      { namesetId: nameset.id, worldId },
      {
        onError: (error) => {
          handleCrudError(error, "Failed to move nameset to trash.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Nameset moved to trash.");
        },
      },
    );
  }

  function handleSetDefault(): void {
    setDefaultMutation.mutate(
      { namesetId: nameset.id, worldId },
      {
        onError: (error) => {
          handleCrudError(error, "Failed to set default nameset.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Default nameset updated.");
        },
      },
    );
  }

  const isPending =
    softDeleteMutation.isPending || setDefaultMutation.isPending;

  return (
    <TableRow>
      <TableCell>
        <span className="inline-flex items-center gap-1.5">
          <span className="font-medium">{nameset.name}</span>
          {nameset.isDefault ? (
            <Badge variant="secondary">default</Badge>
          ) : null}
        </span>
      </TableCell>
      <TableCell>
        <Badge variant="outline">
          {CONVENTION_LABELS[nameset.configJson.convention]}
        </Badge>
      </TableCell>
      <TableCell
        className="text-right tabular-nums text-sm text-muted-foreground"
        title={`${nameset.configJson.male_given_names.length.toString()} male · ${nameset.configJson.female_given_names.length.toString()} female`}
      >
        {givenNamesCount(nameset)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
        {nameset.configJson.surnames.length}
      </TableCell>
      {canEdit ? (
        <TableCell className="text-right">
          <div className="flex items-center justify-end gap-2">
            {!nameset.isDefault ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Set ${nameset.name} as world default`}
                title="Set as world default"
                disabled={isPending}
                onClick={handleSetDefault}
              >
                <Star aria-hidden="true" />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={onEdit}
            >
              Edit
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={
                nameset.isDefault
                  ? `${nameset.name} is the world default and cannot be trashed`
                  : `Move ${nameset.name} to trash`
              }
              title={
                nameset.isDefault
                  ? "Set another nameset as default first"
                  : "Move to trash"
              }
              disabled={nameset.isDefault || isPending}
              onClick={nameset.isDefault ? undefined : handleTrash}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        </TableCell>
      ) : (
        <TableCell />
      )}
    </TableRow>
  );
}

function TrashedNamesetRow({
  nameset,
  queryClient,
  worldId,
}: {
  readonly nameset: Nameset;
  readonly queryClient: QueryClient;
  readonly worldId: string;
}): JSX.Element {
  const restoreMutation = useMutation(
    restoreNamesetMutationOptions({ queryClient }),
  );
  const hardDeleteMutation = useMutation(
    hardDeleteNamesetMutationOptions({ queryClient }),
  );
  const isPending = restoreMutation.isPending || hardDeleteMutation.isPending;

  function handleRestore(): void {
    restoreMutation.mutate(
      { namesetId: nameset.id, worldId },
      {
        onError: (error) => {
          handleCrudError(error, "Failed to restore nameset.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Nameset restored.");
        },
      },
    );
  }

  function handleHardDelete(): void {
    hardDeleteMutation.mutate(
      { namesetId: nameset.id, worldId },
      {
        onError: (error) => {
          handleCrudError(error, "Failed to delete nameset.");
        },
        onSuccess: () => {
          notifyMutationSuccess("Nameset permanently deleted.");
        },
      },
    );
  }

  return (
    <TableRow>
      <TableCell>
        <span className="font-medium">{nameset.name}</span>
      </TableCell>
      <TableCell>
        <Badge variant="outline">
          {CONVENTION_LABELS[nameset.configJson.convention]}
        </Badge>
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
        {givenNamesCount(nameset)}
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
        {nameset.configJson.surnames.length}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={handleRestore}
          >
            <RotateCcw aria-hidden="true" />
            Restore
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isPending}
            onClick={handleHardDelete}
          >
            <Trash2 aria-hidden="true" />
            Delete permanently
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
