import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Tag } from "lucide-react";
import { useState, type JSX } from "react";

import {
  handleCrudError,
  TrashToggleButton,
} from "@/components/shared/ConfigCrudPanel";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { TableSkeleton } from "@/components/shared/SkeletonLoaders";
import { Button } from "@/components/ui/button";
import { resourceCategoriesByWorldQueryOptions } from "@/features/resourceCategories";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationSuccess } from "@/lib/notify";

import { createResourceMutationOptions } from "../../mutations/resourcesMutations";
import { resourcesPageQueryOptions } from "../../queries/resourcesQueries";

import { CreateResourceForm } from "./CreateResourceForm";
import { ManageResourceCategoriesDialog } from "./ManageResourceCategoriesDialog";
import { ResourcesFilters } from "./ResourcesFilters";
import { ResourcesTable } from "./ResourcesTable";

import type { ResourcesSortBy } from "../../queries/resourcesQueries";
import type { CreateResourceInput } from "../../schemas/resourceSchemas";
import type { SortingState } from "@tanstack/react-table";

const PAGE_SIZE = 25;

// Maps a DataTable column id to the resources page query's sort column (see
// resourcesQueries.ts), mirroring the citizens directory table's pattern.
const SORT_BY_ID: Record<string, ResourcesSortBy> = {
  cap: "cap",
  category: "category",
  change: "change",
  name: "name",
};

type ResourcesConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

function ResourcesEmptyState({
  categoryId,
  debouncedSearch,
  onClearFilters,
  showTrash,
}: {
  readonly categoryId: string | null;
  readonly debouncedSearch: string;
  readonly onClearFilters: () => void;
  readonly showTrash: boolean;
}): JSX.Element {
  if (showTrash) {
    return <EmptyState title="No resources in trash" />;
  }
  if (debouncedSearch !== "" || categoryId !== null) {
    return (
      <EmptyState
        title="No matching resources"
        description="Try a different search or filter."
        action={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClearFilters}
          >
            Clear filters
          </Button>
        }
      />
    );
  }
  return (
    <EmptyState
      title="No resources yet"
      description="Add the first resource for this world."
    />
  );
}

export function ResourcesConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: ResourcesConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const canEdit = canAdmin && !isArchived;

  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [showTrash, setShowTrash] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showCategories, setShowCategories] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 300);

  const activeSort = sorting[0];
  const sortBy: ResourcesSortBy | undefined =
    activeSort !== undefined ? SORT_BY_ID[activeSort.id] : undefined;

  const resourcesQuery = useQuery(
    resourcesPageQueryOptions(worldId, {
      categoryId,
      page: pageIndex,
      pageSize: PAGE_SIZE,
      search: debouncedSearch,
      sortBy,
      sortDirection: activeSort?.desc === true ? "desc" : "asc",
      trash: showTrash,
    }),
  );
  const createMutation = useMutation(
    createResourceMutationOptions({ queryClient }),
  );
  const categoriesQuery = useQuery(
    resourceCategoriesByWorldQueryOptions(worldId),
  );

  function resetToFirstPage(): void {
    setPageIndex(0);
  }

  const items = resourcesQuery.data?.items ?? [];
  const totalCount = resourcesQuery.data?.totalCount ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-normal">Resources</h2>
        <div className="flex items-center gap-2">
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowCategories(true);
              }}
            >
              <Tag aria-hidden="true" />
              Manage categories
            </Button>
          ) : null}
          {canEdit && !showForm && !showTrash ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setShowForm(true);
              }}
            >
              <Plus aria-hidden="true" />
              Add resource
            </Button>
          ) : null}
          <TrashToggleButton
            isActive={showTrash}
            onClick={() => {
              setShowTrash((v) => !v);
              resetToFirstPage();
            }}
          />
        </div>
      </div>

      <ResourcesFilters
        categories={categoriesQuery.data ?? []}
        categoryId={categoryId}
        search={search}
        onCategoryIdChange={(next) => {
          setCategoryId(next);
          resetToFirstPage();
        }}
        onSearchChange={(next) => {
          setSearch(next);
          resetToFirstPage();
        }}
      />

      {resourcesQuery.isPending ? (
        <TableSkeleton columnCount={4} rowCount={PAGE_SIZE} />
      ) : resourcesQuery.isError ? (
        <ErrorState
          title="Resources could not be loaded"
          description={getErrorDescription(resourcesQuery.error)}
        />
      ) : items.length === 0 ? (
        <ResourcesEmptyState
          categoryId={categoryId}
          debouncedSearch={debouncedSearch}
          showTrash={showTrash}
          onClearFilters={() => {
            setSearch("");
            setCategoryId(null);
            resetToFirstPage();
          }}
        />
      ) : (
        <>
          <p className="text-xs text-muted-foreground" role="status">
            {`Showing ${(pageIndex * PAGE_SIZE + 1).toString()}–${(
              pageIndex * PAGE_SIZE +
              items.length
            ).toString()} of ${totalCount.toString()}`}
          </p>
          <ResourcesTable
            canEdit={canEdit}
            isPaginationDisabled={resourcesQuery.isFetching}
            pageCount={pageCount}
            pageIndex={pageIndex}
            queryClient={queryClient}
            resources={items}
            showTrash={showTrash}
            sorting={sorting}
            worldId={worldId}
            onPageChange={setPageIndex}
            onSortingChange={(next) => {
              setSorting(next);
              resetToFirstPage();
            }}
          />
        </>
      )}

      {canEdit && showForm && !showTrash ? (
        <CreateResourceForm
          isPending={createMutation.isPending}
          worldId={worldId}
          onCancel={() => {
            setShowForm(false);
          }}
          onSubmit={(input: CreateResourceInput) => {
            createMutation.mutate(input, {
              onError: (error) => {
                handleCrudError(error, "Failed to create resource.");
              },
              onSuccess: () => {
                notifyMutationSuccess("Resource created.");
                setShowForm(false);
              },
            });
          }}
        />
      ) : null}

      {canEdit && showCategories ? (
        <ManageResourceCategoriesDialog
          canAdmin={canAdmin}
          isArchived={isArchived}
          worldId={worldId}
          onClose={() => {
            setShowCategories(false);
          }}
        />
      ) : null}
    </div>
  );
}
