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
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { nationsListQueryOptions } from "@/features/nations";
import { settlementsByWorldQueryOptions } from "@/features/settlements";
import { cn } from "@/lib/utils";

type EventCreateStep2Props = {
  readonly worldId: string;
  readonly scopeType: "world" | "nation" | "settlement" | null;
  readonly selectedIds: string[];
  readonly onSelectedIdsChange: (ids: string[]) => void;
};

export function EventCreateStep2({
  worldId,
  scopeType,
  selectedIds,
  onSelectedIdsChange,
}: EventCreateStep2Props): JSX.Element {
  const [openPopover, setOpenPopover] = useState(false);

  const nationsQuery = useQuery(nationsListQueryOptions(worldId));
  const settlementsQuery = useQuery(settlementsByWorldQueryOptions(worldId));

  const items: Array<{ id: string; name: string }> = (() => {
    if (scopeType === "nation") {
      return Array.from(
        (nationsQuery.data as
          | readonly { id: string; name: string }[]
          | undefined) ?? [],
      );
    }
    if (scopeType === "settlement") {
      return Array.from(
        (settlementsQuery.data as unknown as
          | readonly { id: string; name: string }[]
          | undefined) ?? [],
      );
    }
    return [];
  })();

  const toggleSelection = (id: string): void => {
    if (selectedIds.includes(id)) {
      onSelectedIdsChange(selectedIds.filter((sid) => sid !== id));
    } else {
      onSelectedIdsChange([...selectedIds, id]);
    }
  };

  const getSelectedLabel = (): string => {
    if (selectedIds.length === 0) {
      return scopeType === "nation"
        ? "Select nations…"
        : scopeType === "settlement"
          ? "Select settlements…"
          : "N/A";
    }
    const selected = items.filter((item) => selectedIds.includes(item.id));
    if (selected.length === 1) {
      return selected[0].name;
    }
    return `${selected.length} selected`;
  };

  return (
    <div className="space-y-6">
      {scopeType === "world" && (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            This event will affect the entire world. No specific selection
            needed.
          </p>
        </div>
      )}

      {scopeType !== "world" && (
        <div className="space-y-2">
          <Label className="text-base font-semibold">
            {scopeType === "nation" ? "Select Nations" : "Select Settlements"}
          </Label>

          <Popover open={openPopover} onOpenChange={setOpenPopover}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                className={cn(
                  "w-full justify-between",
                  selectedIds.length === 0 && "text-muted-foreground",
                )}
              >
                {getSelectedLabel()}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput
                  placeholder={
                    scopeType === "nation"
                      ? "Search nations…"
                      : "Search settlements…"
                  }
                />
                <CommandEmpty>
                  {scopeType === "nation"
                    ? "No nations found"
                    : "No settlements found"}
                </CommandEmpty>
                <CommandGroup>
                  <CommandList>
                    {items.map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.id}
                        onSelect={() => toggleSelection(item.id)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedIds.includes(item.id)
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        {item.name}
                      </CommandItem>
                    ))}
                  </CommandList>
                </CommandGroup>
              </Command>
            </PopoverContent>
          </Popover>

          {selectedIds.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {selectedIds.length} selected:
              </p>
              <div className="flex flex-wrap gap-1">
                {items
                  .filter((item) => selectedIds.includes(item.id))
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-sm"
                    >
                      {item.name}
                      <button
                        onClick={() => toggleSelection(item.id)}
                        className="hover:opacity-70"
                      >
                        ×
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
