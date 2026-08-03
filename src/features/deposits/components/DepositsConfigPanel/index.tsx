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

import { createDepositTypeMutationOptions } from "../../mutations/depositsMutations";
import { depositTypesPageQueryOptions } from "../../queries/depositsQueries";

import { CreateDepositTypeForm } from "./CreateDepositTypeForm";
import { DepositsFilters } from "./DepositsFilters";
import { DepositTypesTable } from "./DepositTypesTable";

import type { DepositTypesSortBy } from "../../queries/depositsQueries";
import type { CreateDepositTypeInput } from "../../schemas/depositSchemas";
import type { SortingState } from "@tanstack/react-table";

const PAGE_SIZE = 25;

// Maps a DataTable column id to the deposit types page query's sort column
// (see depositsQueries.ts). Only "name" is sortable now: a deposit type can
// link 1..n jobs, so neither "linked job" nor "output per worker" is a
// single-valued, sortable column anymore (#1246).
const SORT_BY_ID: Record<string, DepositTypesSortBy> = {
  name: "name",
};

type DepositsConfigPanelProps = {
  readonly canAdmin: boolean;
  readonly isArchived: boolean;
  readonly worldId: string;
};

export function DepositsConfigPanel({
  canAdmin,
  isArchived,
  worldId,
}: DepositsConfigPanelProps): JSX.Element {
  const queryClient = useQueryClient();
  const canEdit = canAdmin && !isArchived;

  const [search, setSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [showTrash, setShowTrash] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const debouncedSearch = useDebouncedValue(search, 300);

  const activeSort = sorting[0];
  const sortBy: DepositTypesSortBy | undefined =
    activeSort !== undefined ? SORT_BY_ID[activeSort.id] : undefined;

  const depositTypesPageQuery = useQuery(
    depositTypesPageQueryOptions(worldId, {
      page: pageIndex,
      pageSize: PAGE_SIZE,
      search: debouncedSearch,
      sortBy,
      sortDirection: activeSort?.desc === true ? "desc" : "asc",
      trash: showTrash,
    }),
  );
  const depositJobsQuery = useQuery(jobsByTypeQueryOptions(worldId, "deposit"));
  const createMutation = useMutation(
    createDepositTypeMutationOptions({ queryClient }),
  );

  const depositJobs = depositJobsQuery.data ?? [];

  function resetToFirstPage(): void {
    setPageIndex(0);
  }

  const items = depositTypesPageQuery.data?.items ?? [];
  const totalCount = depositTypesPageQuery.data?.totalCount ?? 0;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-normal">Deposit Types</h2>
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
              Add deposit type
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

      <DepositsFilters
        search={search}
        onSearchChange={(next) => {
          setSearch(next);
          resetToFirstPage();
        }}
      />

      {depositTypesPageQuery.isPending ? (
        <TableSkeleton columnCount={3} rowCount={PAGE_SIZE} />
      ) : depositTypesPageQuery.isError ? (
        <ErrorState
          title="Deposit types could not be loaded"
          description={getErrorDescription(depositTypesPageQuery.error)}
        />
      ) : items.length === 0 ? (
        showTrash ? (
          <EmptyState title="No deposit types in trash" />
        ) : debouncedSearch !== "" ? (
          <EmptyState
            title="No matching deposit types"
            description="Try a different search."
            action={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  resetToFirstPage();
                }}
              >
                Clear search
              </Button>
            }
          />
        ) : (
          <EmptyState
            title="No deposit types yet"
            description="Add the first deposit type for this world."
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
          <DepositTypesTable
            canEdit={canEdit}
            depositJobs={depositJobs}
            depositTypes={items}
            isPaginationDisabled={depositTypesPageQuery.isFetching}
            pageCount={pageCount}
            pageIndex={pageIndex}
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
        <CreateDepositTypeForm
          depositJobs={depositJobs}
          isPending={createMutation.isPending}
          worldId={worldId}
          onCancel={() => {
            setShowForm(false);
          }}
          onSubmit={(input: CreateDepositTypeInput) => {
            createMutation.mutate(input, {
              onError: (error) => {
                handleCrudError(error, "Failed to create deposit type.");
              },
              onSuccess: () => {
                notifyMutationSuccess("Deposit type created.");
                setShowForm(false);
              },
            });
          }}
        />
      ) : null}
    </div>
  );
}
