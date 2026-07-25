// Debounced, server-side citizen directory search shared by every citizen
// picker (CitizenPicker, CitizenMultiPicker, TurnLogCitizenCombobox). Runs only
// while the popover is open so a closed picker holds no live query.

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { useDebouncedValue } from "@/hooks/useDebouncedValue";

import { citizensDirectoryQueryOptions } from "../queries/citizenDirectoryQueries";

import type { CitizenDirectoryRow } from "../queries/citizenDirectoryQueries";
import type { CitizenStatus, CitizenType } from "../types/citizenTypes";

export const CITIZEN_PICKER_PAGE_SIZE = 20;
export const CITIZEN_SEARCH_PLACEHOLDER = "Search citizens…";

export type CitizenTypeFilter = "all" | CitizenType;

type CitizenDirectorySearchOptions = {
  readonly open: boolean;
  readonly citizenType?: CitizenType;
  readonly nationId?: string;
  readonly settlementId?: string;
  readonly status?: CitizenStatus;
};

export function useCitizenDirectorySearch(
  worldId: string,
  {
    open,
    citizenType,
    nationId,
    settlementId,
    status,
  }: CitizenDirectorySearchOptions,
): {
  readonly searchInput: string;
  readonly setSearchInput: (value: string) => void;
  readonly options: readonly CitizenDirectoryRow[];
  readonly isTruncated: boolean;
  readonly isFetching: boolean;
} {
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const searchQuery = useQuery({
    ...citizensDirectoryQueryOptions(
      worldId,
      { citizenType, nationId, search: debouncedSearch, settlementId, status },
      { pageIndex: 0, pageSize: CITIZEN_PICKER_PAGE_SIZE },
    ),
    enabled: open,
  });

  const options = searchQuery.data?.rows ?? [];
  const isTruncated =
    searchQuery.data !== undefined &&
    searchQuery.data.totalCount > options.length;

  return {
    searchInput,
    setSearchInput,
    options,
    isTruncated,
    isFetching: searchQuery.isFetching,
  };
}
