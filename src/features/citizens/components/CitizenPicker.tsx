// Reusable searchable citizen picker (#1160, #1189): debounced server-side
// name search over citizen_directory_view with a player/NPC filter toggle
// and settlement + role metadata per row. Shared by the settlement manager
// assignment flow and decree issuance instead of each growing its own
// combobox variant (see TurnLogCitizenCombobox, which stays separate since
// its "All citizens" option and undefined-based clearing serve a filter bar
// rather than a staged selection). The search hook and row rendering live in
// citizenPickerShared, reused by CitizenMultiPicker.

import { useQuery } from "@tanstack/react-query";
import { ChevronsUpDown, X } from "lucide-react";
import { useState, type JSX } from "react";

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
import { cn } from "@/lib/utils";

import {
  CITIZEN_SEARCH_PLACEHOLDER,
  useCitizenDirectorySearch,
  type CitizenTypeFilter,
} from "../hooks/useCitizenDirectorySearch";
import { citizenByIdQueryOptions } from "../queries/citizensQueries";

import {
  CitizenOptionRow,
  CitizenSearchTruncationNote,
  CitizenTypeFilterToggle,
} from "./CitizenPickerParts";

import type { CitizenStatus } from "../types/citizenTypes";

type CitizenPickerProps = {
  readonly citizenId: string | null;
  readonly id?: string;
  readonly nationId?: string;
  readonly onChange: (citizenId: string | null) => void;
  readonly placeholder?: string;
  readonly settlementId?: string;
  readonly statusFilter?: CitizenStatus;
  readonly worldId: string;
};

export function CitizenPicker({
  citizenId,
  id,
  nationId,
  onChange,
  placeholder = "Select citizen…",
  settlementId,
  statusFilter,
  worldId,
}: CitizenPickerProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [typeFilter, setTypeFilter] = useState<CitizenTypeFilter>("all");

  const selectedQuery = useQuery({
    ...citizenByIdQueryOptions(citizenId ?? ""),
    enabled: citizenId !== null,
  });

  const { searchInput, setSearchInput, options, isTruncated, isFetching } =
    useCitizenDirectorySearch(worldId, {
      citizenType: typeFilter === "all" ? undefined : typeFilter,
      nationId,
      open,
      settlementId,
      status: statusFilter,
    });

  const triggerLabel =
    citizenId === null ? placeholder : (selectedQuery.data?.name ?? "Loading…");

  function handleClear(): void {
    onChange(null);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger asChild>
          <Button
            aria-expanded={open}
            id={id}
            role="combobox"
            type="button"
            variant="outline"
            className={cn(
              "w-full justify-between font-normal",
              citizenId !== null && "pr-8",
            )}
          >
            <span className="truncate">{triggerLabel}</span>
            <ChevronsUpDown
              aria-hidden="true"
              className="ml-2 size-4 shrink-0 opacity-50"
            />
          </Button>
        </PopoverTrigger>
        {citizenId === null ? null : (
          <button
            aria-label="Clear selection"
            className="absolute top-1/2 right-7 -translate-y-1/2 rounded-sm p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={(event) => {
              event.stopPropagation();
              handleClear();
            }}
            type="button"
          >
            <X aria-hidden="true" className="size-3.5" />
          </button>
        )}
      </div>
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
              {citizenId === null ? null : (
                <CommandItem
                  className="text-muted-foreground"
                  onSelect={handleClear}
                  value="__clear__"
                >
                  Clear selection
                </CommandItem>
              )}
              {options.map((citizen) => (
                <CommandItem
                  key={citizen.id}
                  onSelect={() => {
                    onChange(citizen.id);
                    setOpen(false);
                  }}
                  value={citizen.id}
                >
                  <CitizenOptionRow
                    citizen={citizen}
                    isSelected={citizenId === citizen.id}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {isTruncated ? <CitizenSearchTruncationNote /> : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
