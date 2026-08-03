// Presentational parts shared by the staged-selection citizen pickers
// (CitizenPicker, CitizenMultiPicker): the player/NPC filter toggle, the rich
// option row and the truncation note they render identically.

import { Check } from "lucide-react";
import { type JSX } from "react";

import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

import { CITIZEN_PICKER_PAGE_SIZE } from "../hooks/useCitizenDirectorySearch";

import type { CitizenTypeFilter } from "../hooks/useCitizenDirectorySearch";
import type { CitizenDirectoryRow } from "../queries/citizenDirectoryQueries";

/** Player/NPC/all toggle bar shown above the picker option list. */
export function CitizenTypeFilterToggle({
  onChange,
  value,
}: {
  readonly onChange: (value: CitizenTypeFilter) => void;
  readonly value: CitizenTypeFilter;
}): JSX.Element {
  return (
    <div className="border-b border-border p-2">
      <ToggleGroup
        type="single"
        value={value}
        onValueChange={(next) => {
          if (next !== "") {
            onChange(next as CitizenTypeFilter);
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
  );
}

/** Inner content of a picker option: selection check, name, type/dead badges. */
export function CitizenOptionRow({
  citizen,
  isSelected,
}: {
  readonly citizen: CitizenDirectoryRow;
  readonly isSelected: boolean;
}): JSX.Element {
  return (
    <>
      <Check
        className={cn(
          "mr-2 size-4 shrink-0",
          isSelected ? "opacity-100" : "opacity-0",
        )}
      />
      <span className="grid min-w-0 flex-1 gap-0.5">
        <span className="flex items-center gap-2 truncate">
          {citizen.name ?? "Unnamed citizen"}
          <Badge
            variant={citizen.citizenType === "npc" ? "secondary" : "outline"}
          >
            {citizen.citizenType === "npc" ? "NPC" : "Player"}
          </Badge>
          {citizen.status === "dead" ? (
            <Badge variant="destructive">Dead</Badge>
          ) : null}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {citizen.settlementName ?? "No settlement"}
          {citizen.officeTypes === null ? "" : ` · ${citizen.officeTypes}`}
        </span>
      </span>
    </>
  );
}

/** Footer note shown when the directory search returned more than one page. */
export function CitizenSearchTruncationNote(): JSX.Element {
  return (
    <p className="border-t border-border px-2 py-1.5 text-xs text-muted-foreground">
      Showing first {CITIZEN_PICKER_PAGE_SIZE} — refine your search
    </p>
  );
}
