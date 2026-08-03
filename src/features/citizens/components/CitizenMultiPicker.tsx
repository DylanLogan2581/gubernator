// Multi-select variant of CitizenPicker (#1334): the same debounced
// server-side name search over citizen_directory_view, but selections
// accumulate instead of replacing and stay open across picks. Selected
// citizens render as removable badges below the trigger. Used by the
// government-bodies "citizens" composition rule. Search and row rendering are
// shared with CitizenPicker via citizenPickerShared.

import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown, X } from "lucide-react";
import { useState, type JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

import {
  CITIZEN_SEARCH_PLACEHOLDER,
  useCitizenDirectorySearch,
  type CitizenTypeFilter,
} from "../hooks/useCitizenDirectorySearch";
import { citizensByIdsQueryOptions } from "../queries/citizensQueries";

import {
  CitizenOptionRow,
  CitizenSearchTruncationNote,
  CitizenTypeFilterToggle,
} from "./CitizenPickerParts";

import type { CitizenStatus } from "../types/citizenTypes";

type CitizenMultiPickerProps = {
  readonly citizenIds: readonly string[];
  readonly id?: string;
  readonly nationId?: string;
  readonly onChange: (citizenIds: readonly string[]) => void;
  readonly placeholder?: string;
  readonly settlementId?: string;
  readonly statusFilter?: CitizenStatus;
  readonly worldId: string;
};

export function CitizenMultiPicker({
  citizenIds,
  id,
  nationId,
  onChange,
  placeholder = "Select citizens…",
  settlementId,
  statusFilter,
  worldId,
}: CitizenMultiPickerProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<CitizenTypeFilter>("all");

  const selectedQuery = useQuery(citizensByIdsQueryOptions(citizenIds));
  const nameById = new Map(
    (selectedQuery.data ?? []).map((citizen) => [citizen.id, citizen.name]),
  );

  const { searchInput, setSearchInput, options, isTruncated, isFetching } =
    useCitizenDirectorySearch(worldId, {
      citizenType: typeFilter === "all" ? undefined : typeFilter,
      nationId,
      open,
      settlementId,
      status: statusFilter,
    });

  function toggle(citizenId: string): void {
    onChange(
      citizenIds.includes(citizenId)
        ? citizenIds.filter((existingId) => existingId !== citizenId)
        : [...citizenIds, citizenId],
    );
  }

  function remove(citizenId: string): void {
    onChange(citizenIds.filter((existingId) => existingId !== citizenId));
  }

  return (
    <div className="grid gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            aria-expanded={open}
            id={id}
            role="combobox"
            type="button"
            variant="outline"
            className="w-full justify-between font-normal"
          >
            <span className="truncate">
              {citizenIds.length === 0
                ? placeholder
                : `${citizenIds.length} selected`}
            </span>
            <ChevronsUpDown
              aria-hidden="true"
              className="ml-2 size-4 shrink-0 opacity-50"
            />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] p-0"
        >
          <Command shouldFilter={false}>
            <CommandInput
              onValueChange={setSearchInput}
              placeholder={CITIZEN_SEARCH_PLACEHOLDER}
              value={searchInput}
            />
            <CitizenTypeFilterToggle
              value={typeFilter}
              onChange={setTypeFilter}
            />
            <CommandList>
              <CommandEmpty>
                {isFetching ? "Searching…" : "No citizens found."}
              </CommandEmpty>
              <CommandGroup>
                {options.map((citizen) => (
                  <CommandItem
                    key={citizen.id}
                    onSelect={() => toggle(citizen.id)}
                    value={citizen.id}
                  >
                    <CitizenOptionRow
                      citizen={citizen}
                      isSelected={citizenIds.includes(citizen.id)}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            {isTruncated ? <CitizenSearchTruncationNote /> : null}
          </Command>
        </PopoverContent>
      </Popover>
      {citizenIds.length === 0 ? null : (
        <div className="flex flex-wrap gap-1">
          {citizenIds.map((citizenId) => (
            <Badge key={citizenId} variant="secondary" className="gap-1">
              {nameById.get(citizenId) ?? citizenId}
              <button
                aria-label="Remove citizen"
                onClick={() => remove(citizenId)}
                type="button"
              >
                <X aria-hidden="true" className="size-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
