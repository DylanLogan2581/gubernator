// Reusable searchable citizen picker (#1160, #1189): debounced server-side
// name search over citizen_directory_view with a player/NPC filter toggle
// and settlement + role metadata per row. Shared by the settlement manager
// assignment flow and decree issuance instead of each growing its own
// combobox variant (see TurnLogCitizenCombobox, which stays separate since
// its "All citizens" option and undefined-based clearing serve a filter bar
// rather than a staged selection).

import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, X } from "lucide-react";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";

import { citizensDirectoryQueryOptions } from "../queries/citizenDirectoryQueries";
import { citizenByIdQueryOptions } from "../queries/citizensQueries";

import type { CitizenStatus, CitizenType } from "../types/citizenTypes";

type CitizenTypeFilter = "all" | CitizenType;

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

const PAGE_SIZE = 20;
const SEARCH_PLACEHOLDER = "Search citizens…";

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
  const [searchInput, setSearchInput] = useState("");
  const [typeFilter, setTypeFilter] = useState<CitizenTypeFilter>("all");
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const selectedQuery = useQuery({
    ...citizenByIdQueryOptions(citizenId ?? ""),
    enabled: citizenId !== null,
  });

  const searchQuery = useQuery({
    ...citizensDirectoryQueryOptions(
      worldId,
      {
        citizenType: typeFilter === "all" ? undefined : typeFilter,
        nationId,
        search: debouncedSearch,
        settlementId,
        status: statusFilter,
      },
      { pageIndex: 0, pageSize: PAGE_SIZE },
    ),
    enabled: open,
  });

  const options = searchQuery.data?.rows ?? [];
  const isTruncated =
    searchQuery.data !== undefined &&
    searchQuery.data.totalCount > options.length;
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
            placeholder={SEARCH_PLACEHOLDER}
            value={searchInput}
          />
          <div className="border-b border-border p-2">
            <ToggleGroup
              type="single"
              value={typeFilter}
              onValueChange={(value) => {
                if (value !== "") {
                  setTypeFilter(value as CitizenTypeFilter);
                }
              }}
              className="justify-start"
            >
              <ToggleGroupItem
                value="all"
                aria-label="All citizens"
                className="rounded-full border px-3 py-1 text-xs font-medium data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                All
              </ToggleGroupItem>
              <ToggleGroupItem
                value="player_character"
                aria-label="Players only"
                className="rounded-full border px-3 py-1 text-xs font-medium data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                Players
              </ToggleGroupItem>
              <ToggleGroupItem
                value="npc"
                aria-label="NPCs only"
                className="rounded-full border px-3 py-1 text-xs font-medium data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
              >
                NPCs
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <CommandList>
            <CommandEmpty>
              {searchQuery.isFetching ? "Searching…" : "No citizens found."}
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
                  <Check
                    className={cn(
                      "mr-2 size-4 shrink-0",
                      citizenId === citizen.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <span className="grid min-w-0 flex-1 gap-0.5">
                    <span className="flex items-center gap-2 truncate">
                      {citizen.name ?? "Unnamed citizen"}
                      <Badge
                        variant={
                          citizen.citizenType === "npc"
                            ? "secondary"
                            : "outline"
                        }
                      >
                        {citizen.citizenType === "npc" ? "NPC" : "Player"}
                      </Badge>
                      {citizen.status === "dead" ? (
                        <Badge variant="destructive">Dead</Badge>
                      ) : null}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {citizen.settlementName ?? "No settlement"}
                      {citizen.officeTypes === null
                        ? ""
                        : ` · ${citizen.officeTypes}`}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
          {isTruncated ? (
            <p className="border-t border-border px-2 py-1.5 text-xs text-muted-foreground">
              Showing first {PAGE_SIZE} — refine your search
            </p>
          ) : null}
        </Command>
      </PopoverContent>
    </Popover>
  );
}
