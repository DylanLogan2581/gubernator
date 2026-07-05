import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState, type JSX } from "react";

import { TrashToggleButton } from "@/components/shared/ConfigCrudPanel";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { TableSkeleton } from "@/components/shared/SkeletonLoaders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getErrorDescription } from "@/lib/errorUtils";

import { useCreateBlueprintWithTiers } from "../hooks/useCreateBlueprintWithTiers";
import { blueprintsPageQueryOptions } from "../queries/buildingsQueries";

import { BlueprintTierEditor } from "./BlueprintTierEditor";
import { BlueprintsTable } from "./BuildingsConfigPanel/BlueprintsTable";
import { CreateBlueprintForm } from "./BuildingsConfigPanel/CreateBlueprintForm";

const PAGE_SIZE = 25;

type BuildingsConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly selectedBlueprintId?: string;
  readonly worldId: string;
};

export function BuildingsConfigPanel({
  canAdmin,
  isArchived,
  selectedBlueprintId,
  worldId,
}: BuildingsConfigPanelProps): JSX.Element {
  if (selectedBlueprintId !== undefined) {
    return (
      <BlueprintTierEditor
        blueprintId={selectedBlueprintId}
        canAdmin={canAdmin}
        isArchived={isArchived}
        worldId={worldId}
      />
    );
  }

  return (
    <BlueprintListPanel
      canAdmin={canAdmin}
      isArchived={isArchived}
      worldId={worldId}
    />
  );
}

function BlueprintListPanel({
  canAdmin,
  isArchived,
  worldId,
}: {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
}): JSX.Element {
  const queryClient = useQueryClient();
  const canEdit = canAdmin && !isArchived;
  const { submit } = useCreateBlueprintWithTiers();

  const [search, setSearch] = useState("");
  const [pageIndex, setPageIndex] = useState(0);
  const [showTrash, setShowTrash] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 300);

  const blueprintsQuery = useQuery(
    blueprintsPageQueryOptions(worldId, {
      page: pageIndex,
      pageSize: PAGE_SIZE,
      search: debouncedSearch,
      trash: showTrash,
    }),
  );

  function resetToFirstPage(): void {
    setPageIndex(0);
  }

  const items = blueprintsQuery.data?.items ?? [];
  const totalCount = blueprintsQuery.data?.totalCount ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-normal">Buildings</h2>
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
              Add blueprint
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
        aria-label="Search blueprints by name"
        className="sm:w-[280px]"
        placeholder="Search by name…"
        value={search}
        onChange={(event) => {
          setSearch(event.currentTarget.value);
          resetToFirstPage();
        }}
      />

      {blueprintsQuery.isPending ? (
        <TableSkeleton columnCount={3} rowCount={PAGE_SIZE} />
      ) : blueprintsQuery.isError ? (
        <ErrorState
          title="Buildings could not be loaded"
          description={getErrorDescription(blueprintsQuery.error)}
        />
      ) : items.length === 0 ? (
        showTrash ? (
          <EmptyState title="No buildings in trash" />
        ) : debouncedSearch !== "" ? (
          <EmptyState
            title="No matching buildings"
            description="Try a different search."
          />
        ) : (
          <EmptyState
            title="No buildings yet"
            description="Add the first building for this world."
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
          <BlueprintsTable
            blueprints={items}
            canEdit={canEdit}
            isPaginationDisabled={blueprintsQuery.isFetching}
            pageCount={pageCount}
            pageIndex={pageIndex}
            queryClient={queryClient}
            showTrash={showTrash}
            worldId={worldId}
            onPageChange={setPageIndex}
          />
        </>
      )}

      {canEdit && showForm && !showTrash ? (
        <CreateBlueprintForm
          worldId={worldId}
          onCancel={() => {
            setShowForm(false);
          }}
          onSubmit={(input, pendingTiers) => {
            void submit(input, pendingTiers);
          }}
        />
      ) : null}
    </div>
  );
}
