// Searchable citizen picker for admins/superadmins issuing a decree when no
// manager citizen resolves automatically (#1159). Mirrors
// TurnLogCitizenCombobox's debounced citizen_directory_view search but
// requires an explicit pick (no "clear" option) and scopes results to the
// decree's nation or settlement.

import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown } from "lucide-react";
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
import {
  citizenByIdQueryOptions,
  citizensDirectoryQueryOptions,
} from "@/features/citizens";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { cn } from "@/lib/utils";

type DecreeIssuerComboboxProps = {
  readonly citizenId: string | null;
  readonly nationId: string;
  readonly onChange: (citizenId: string) => void;
  readonly settlementId?: string;
  readonly worldId: string;
};

export function DecreeIssuerCombobox({
  citizenId,
  nationId,
  onChange,
  settlementId,
  worldId,
}: DecreeIssuerComboboxProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 300);

  const selectedQuery = useQuery({
    ...citizenByIdQueryOptions(citizenId ?? ""),
    enabled: citizenId !== null,
  });

  const searchQuery = useQuery({
    ...citizensDirectoryQueryOptions(
      worldId,
      settlementId === undefined
        ? { nationId, search: debouncedSearch }
        : { search: debouncedSearch, settlementId },
      { pageIndex: 0, pageSize: 20 },
    ),
    enabled: open,
  });

  const options = searchQuery.data?.rows ?? [];
  const selectedLabel =
    citizenId === null
      ? "Select citizen…"
      : (selectedQuery.data?.name ?? "Loading…");

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          aria-expanded={open}
          role="combobox"
          type="button"
          variant="outline"
          className="w-full justify-between font-normal"
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0">
        <Command shouldFilter={false}>
          <CommandInput
            onValueChange={setSearchInput}
            placeholder="Search citizens…"
            value={searchInput}
          />
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
