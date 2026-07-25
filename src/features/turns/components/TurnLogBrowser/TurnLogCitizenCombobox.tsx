// Debounced, server-searched citizen picker for the turn log filter bar.
// Replaces a native <select> populated with every citizen in the world —
// which doesn't scale — with an async search over citizen_directory_view,
// the same server-side-filtered source the citizens directory page uses. The
// debounced search itself is shared with the staged-selection citizen pickers
// (useCitizenDirectorySearch); the "All citizens" option and plain rows here
// are bespoke to the filter bar.

import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

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
  citizenByIdQueryOptions,
  CITIZEN_SEARCH_PLACEHOLDER,
  useCitizenDirectorySearch,
} from "@/features/citizens";
import { cn } from "@/lib/utils";

import type { JSX } from "react";

type TurnLogCitizenComboboxProps = {
  readonly citizenId: string | undefined;
  readonly id?: string;
  readonly onChange: (citizenId: string | undefined) => void;
  readonly worldId: string;
};

export function TurnLogCitizenCombobox({
  citizenId,
  id,
  onChange,
  worldId,
}: TurnLogCitizenComboboxProps): JSX.Element {
  const [open, setOpen] = useState(false);

  const selectedQuery = useQuery({
    ...citizenByIdQueryOptions(citizenId ?? ""),
    enabled: citizenId !== undefined,
  });

  const { searchInput, setSearchInput, options, isFetching } =
    useCitizenDirectorySearch(worldId, { open });

  const selectedLabel =
    citizenId === undefined
      ? "All citizens"
      : (selectedQuery.data?.name ?? "Loading…");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          id={id}
          role="combobox"
          variant="outline"
          className="h-8 w-full justify-between font-normal text-sm"
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command shouldFilter={false}>
          <CommandInput
            onValueChange={setSearchInput}
            placeholder={CITIZEN_SEARCH_PLACEHOLDER}
            value={searchInput}
          />
          <CommandList>
            <CommandEmpty>
              {isFetching ? "Searching…" : "No citizens found."}
            </CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  onChange(undefined);
                  setOpen(false);
                }}
                value="__all__"
              >
                <Check
                  className={cn(
                    "mr-2 size-4",
                    citizenId === undefined ? "opacity-100" : "opacity-0",
                  )}
                />
                All citizens
              </CommandItem>
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
                      "mr-2 size-4",
                      citizenId === citizen.id ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {citizen.name ?? "Unnamed citizen"}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
