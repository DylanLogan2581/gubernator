// Multi-select variant of CitizenPicker (#1334): the same debounced
// server-side name search over citizen_directory_view, but selections
// accumulate instead of replacing and stay open across picks. Selected
// citizens render as removable badges below the trigger. Used by the
// government-bodies "citizens" composition rule.

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
import { citizensByIdsQueryOptions } from "../queries/citizensQueries";

import type { CitizenStatus, CitizenType } from "../types/citizenTypes";

type CitizenTypeFilter = "all" | CitizenType;

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

const PAGE_SIZE = 20;
const SEARCH_PLACEHOLDER = "Search citizens…";

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
  const [searchInput, setSearchInput] = useState("");
  const [typeFilter, setTypeFilter] = useState<CitizenTypeFilter>("all");
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const selectedQuery = useQuery(citizensByIdsQueryOptions(citizenIds));
  const nameById = new Map(
    (selectedQuery.data ?? []).map((citizen) => [citizen.id, citizen.name]),
  );

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
                {options.map((citizen) => {
                  const checked = citizenIds.includes(citizen.id);
                  return (
                    <CommandItem
                      key={citizen.id}
                      onSelect={() => toggle(citizen.id)}
                      value={citizen.id}
                    >
                      <Check
                        className={cn(
                          "mr-2 size-4 shrink-0",
                          checked ? "opacity-100" : "opacity-0",
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
                  );
                })}
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
