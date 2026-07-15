import { Check, ChevronsUpDown } from "lucide-react";
import { useState, type JSX } from "react";

import { IconChip } from "@/components/shared/IconChip";
import {
  CURATED_ICON_NAMES,
  formatIconLabel,
  resolveEntityIcon,
} from "@/components/shared/iconPicker/CuratedIcons";
import { GameIconsPanel } from "@/components/shared/iconPicker/GameIconsPanel";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type IconPickerProps = {
  readonly value: string | null;
  readonly onChange: (value: string | null) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
};

/**
 * Searchable, keyboard-navigable picker over the curated Lucide icon set
 * (see `CuratedIcons.ts`). Value is the icon's stable kebab-case name, or
 * null for "no icon" — never a component reference, so it round-trips
 * through the `icon` text column unchanged.
 *
 * Icons are always rendered through `IconChip` (never bound to a local
 * capitalized variable and used directly as a JSX tag) so the resolved
 * component reference is just a prop value, not something the render body
 * appears to construct.
 */
export function IconPicker({
  value,
  onChange,
  disabled,
  placeholder = "Choose icon…",
}: IconPickerProps): JSX.Element {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            value === null && "text-muted-foreground",
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <IconChip
              icon={resolveEntityIcon(value)}
              tone="default"
              size="sm"
            />
            {value !== null ? formatIconLabel(value) : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 p-0"
        align="start"
        side="bottom"
        avoidCollisions={false}
      >
        <Tabs defaultValue="curated">
          <TabsList className="m-2">
            <TabsTrigger value="curated">Curated</TabsTrigger>
            <TabsTrigger value="game-icons">Game Icons</TabsTrigger>
          </TabsList>
          <TabsContent value="curated">
            <Command>
              <CommandInput placeholder="Search icons…" />
              <CommandList>
                <CommandEmpty>No icons found.</CommandEmpty>
                <CommandGroup
                  className={cn(
                    "[&_[cmdk-group-items]]:grid",
                    "[&_[cmdk-group-items]]:grid-cols-6",
                    "[&_[cmdk-group-items]]:gap-1",
                    "[&_[cmdk-group-items]]:p-2",
                  )}
                >
                  {value !== null && (
                    <CommandItem
                      value="__clear__ clear no icon"
                      onSelect={() => {
                        onChange(null);
                        setOpen(false);
                      }}
                      className="col-span-6 flex items-center justify-center gap-2 text-muted-foreground"
                    >
                      Clear icon
                    </CommandItem>
                  )}
                  {CURATED_ICON_NAMES.map((name) => {
                    const label = formatIconLabel(name);
                    const isSelected = value === name;
                    return (
                      <CommandItem
                        key={name}
                        value={`${name} ${label}`}
                        onSelect={() => {
                          onChange(name);
                          setOpen(false);
                        }}
                        title={label}
                        aria-label={label}
                        className={cn(
                          "relative col-span-1 flex h-14 items-center justify-center px-0",
                          isSelected && "bg-accent text-accent-foreground",
                        )}
                      >
                        <IconChip icon={resolveEntityIcon(name)} size="lg" />
                        {isSelected && (
                          <Check className="absolute right-0.5 top-0.5 size-3" />
                        )}
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </TabsContent>
          <TabsContent value="game-icons">
            <GameIconsPanel
              value={value}
              onSelect={(name) => {
                onChange(name);
                setOpen(false);
              }}
            />
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
