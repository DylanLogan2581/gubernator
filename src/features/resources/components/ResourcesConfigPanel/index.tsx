import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState, type JSX } from "react";

import {
  handleCrudError,
  TrashToggleButton,
} from "@/components/shared/ConfigCrudPanel";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { TableSkeleton } from "@/components/shared/SkeletonLoaders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationSuccess } from "@/lib/notify";

import { createResourceMutationOptions } from "../../mutations/resourcesMutations";
import { resourcesPageQueryOptions } from "../../queries/resourcesQueries";

import { CreateResourceForm } from "./CreateResourceForm";
import { ResourcesTable } from "./ResourcesTable";

import type { CreateResourceInput } from "../../schemas/resourceSchemas";

const PAGE_SIZE = 25;

type ResourcesConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function ResourcesConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: ResourcesConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const canEdit = canAdmin && !isArchived;

  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [showTrash, setShowTrash] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 300);

  const resourcesQuery = useQuery(
    resourcesPageQueryOptions(worldId, {
      page: pageIndex,
      pageSize: PAGE_SIZE,
      search: debouncedSearch,
      trash: showTrash,
    }),
  );
  const createMutation = useMutation(
    createResourceMutationOptions({ queryClient }),
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

      <Input
        aria-label="Search resources by name"
        className="sm:w-[280px]"
        placeholder="Search by name…"
        value={search}
        onChange={(event) => {
          setSearch(event.currentTarget.value);
          resetToFirstPage();
        }}
      />

      {resourcesQuery.isPending ? (
        <TableSkeleton columnCount={3} rowCount={PAGE_SIZE} />
      ) : resourcesQuery.isError ? (
        <ErrorState
          title="Resources could not be loaded"
          description={getErrorDescription(resourcesQuery.error)}
        />
      ) : items.length === 0 ? (
        showTrash ? (
          <EmptyState title="No resources in trash" />
        ) : debouncedSearch !== "" ? (
          <EmptyState
            title="No matching resources"
            description="Try a different search."
          />
        ) : (
          <EmptyState
            title="No resources yet"
            description="Add the first resource for this world."
          />
        )
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
            worldId={worldId}
            onPageChange={setPageIndex}
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
    </div>
  );
}
