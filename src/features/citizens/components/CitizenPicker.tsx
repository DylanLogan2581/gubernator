// Reusable searchable citizen picker (#1160): debounced server-side name
// search over citizen_directory_view with a player/NPC filter toggle and
// settlement + status metadata per row. Built to replace full-population
// candidate lists that don't scale past a few hundred citizens -- the
// settlement manager assignment flow is the first adopter; decrees and
// government body composition can adopt it too instead of growing their
// own combobox variants (see DecreeIssuerCombobox, TurnLogCitizenCombobox).

import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
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

import type { CitizenStatus, CitizenType } from "../types/citizenTypes";

type CitizenTypeFilter = "all" | CitizenType;

type CitizenPickerProps = {
  readonly citizenId: string | null;
  readonly id?: string;
  readonly nationId?: string;
  readonly onChange: (citizenId: string) => void;
  readonly placeholder?: string;
  readonly settlementId?: string;
  readonly statusFilter?: CitizenStatus;
  readonly worldId: string;
};

const PAGE_SIZE = 20;

export function CitizenPicker({
  citizenId,
  id,
  nationId,
  onChange,
  placeholder = "Search citizens…",
  settlementId,
  statusFilter,
  worldId,
}: CitizenPickerProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [typeFilter, setTypeFilter] = useState<CitizenTypeFilter>("all");
  const debouncedSearch = useDebouncedValue(searchInput, 300);

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

  return (
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
          <span className="truncate">{placeholder}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <Command shouldFilter={false}>
          <CommandInput
            onValueChange={setSearchInput}
            placeholder={placeholder}
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
                        {citizen.citizenType === "npc" ? "NPC" : "PC"}
                      </Badge>
                      {citizen.status === "dead" ? (
                        <Badge variant="destructive">Dead</Badge>
                      ) : null}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {citizen.settlementName ?? "No settlement"}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
