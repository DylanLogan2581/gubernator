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
import { jobsByTypeQueryOptions } from "@/features/jobs";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { getErrorDescription } from "@/lib/errorUtils";
import { notifyMutationSuccess } from "@/lib/notify";

import { createManagedPopulationTypeMutationOptions } from "../../mutations/managedPopulationsMutations";
import { managedPopulationTypesPageQueryOptions } from "../../queries/managedPopulationsQueries";

import { CreateManagedPopulationTypeForm } from "./components/CreateManagedPopulationTypeForm";
import { ManagedPopulationsFilters } from "./components/ManagedPopulationsFilters";
import { ManagedPopulationTypesTable } from "./components/ManagedPopulationTypesTable";

import type { ManagedPopulationTypesSortBy } from "../../queries/managedPopulationsQueries";
import type { CreateManagedPopulationTypeInput } from "../../schemas/managedPopulationSchemas";
import type { SortingState } from "@tanstack/react-table";

const PAGE_SIZE = 25;

// Maps a DataTable column id to the managed population types page query's
// sort column (see managedPopulationsQueries.ts). Only "name" and
// "growthRate" are sortable now: a population type can link 1..n husbandry
// jobs and 1..n culling jobs, so neither "husbandry job", "culling job", nor
// "husbandry workers per N animals" is a single-valued, sortable column
// anymore (mirroring the deposit_type_jobs precedent, #1246/#1247).
const SORT_BY_ID: Record<string, ManagedPopulationTypesSortBy> = {
  growthRate: "growthRate",
  name: "name",
};

type ManagedPopulationsConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function ManagedPopulationsConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: ManagedPopulationsConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const canEdit = canAdmin && !isArchived;

  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [showTrash, setShowTrash] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 300);

  const activeSort = sorting[0];
  const sortBy: ManagedPopulationTypesSortBy | undefined =
    activeSort !== undefined ? SORT_BY_ID[activeSort.id] : undefined;

  const populationTypesPageQuery = useQuery(
    managedPopulationTypesPageQueryOptions(worldId, {
      page: pageIndex,
      pageSize: PAGE_SIZE,
      search: debouncedSearch,
      sortBy,
      sortDirection: activeSort?.desc === true ? "desc" : "asc",
      trash: showTrash,
    }),
  );

  const husbandryJobsQuery = useQuery(
    jobsByTypeQueryOptions(worldId, "husbandry"),
  );
  const cullingJobsQuery = useQuery(jobsByTypeQueryOptions(worldId, "culling"));

  const createMutation = useMutation(
    createManagedPopulationTypeMutationOptions({ queryClient }),
  );

  function resetToFirstPage(): void {
    setPageIndex(0);
  }

  const items = populationTypesPageQuery.data?.items ?? [];
  const totalCount = populationTypesPageQuery.data?.totalCount ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const husbandryJobs = husbandryJobsQuery.data ?? [];
  const cullingJobs = cullingJobsQuery.data ?? [];

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-normal">
          Managed Population Types
        </h2>
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
              Add population type
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

      <ManagedPopulationsFilters
        search={search}
        onSearchChange={(next) => {
          setSearch(next);
          resetToFirstPage();
        }}
      />

      {populationTypesPageQuery.isPending ? (
        <TableSkeleton columnCount={6} rowCount={PAGE_SIZE} />
      ) : populationTypesPageQuery.isError ? (
        <ErrorState
          title="Managed population types could not be loaded"
          description={getErrorDescription(populationTypesPageQuery.error)}
        />
      ) : items.length === 0 ? (
        showTrash ? (
          <EmptyState title="No managed population types in trash" />
        ) : debouncedSearch !== "" ? (
          <EmptyState
            title="No matching managed population types"
            description="Try a different search."
          />
        ) : (
          <EmptyState
            title="No managed population types yet"
            description="Add the first managed population type for this world."
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
          <ManagedPopulationTypesTable
            canEdit={canEdit}
            cullingJobs={cullingJobs}
            husbandryJobs={husbandryJobs}
            isPaginationDisabled={populationTypesPageQuery.isFetching}
            pageCount={pageCount}
            pageIndex={pageIndex}
            populationTypes={items}
            queryClient={queryClient}
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
        <CreateManagedPopulationTypeForm
          cullingJobs={cullingJobs}
          husbandryJobs={husbandryJobs}
          isPending={createMutation.isPending}
          worldId={worldId}
          onCancel={() => {
            setShowForm(false);
          }}
          onSubmit={(input: CreateManagedPopulationTypeInput) => {
            createMutation.mutate(input, {
              onError: (error) => {
                handleCrudError(
                  error,
                  "Failed to create managed population type.",
                );
              },
              onSuccess: () => {
                notifyMutationSuccess("Managed population type created.");
                setShowForm(false);
              },
            });
          }}
        />
      ) : null}
    </div>
  );
}
