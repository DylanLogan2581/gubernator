// Filter controls for the turn log browser.
// Fields hidden when their value is locked via fixedFilter.
// The controls themselves live behind a "Filters" popover (collapsed by
// default) — active selections surface as removable chips next to the
// trigger so the filter bar doesn't outweigh the log content.

import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { citizenByIdQueryOptions } from "@/features/citizens";
import { nationsListQueryOptions } from "@/features/nations";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { settlementsByWorldQueryOptions } from "@/features/settlements";
import { LOG_CODES } from "@/shared/simulation";

import {
  LOG_CATEGORY_LABELS,
  logCategoryLabel,
} from "../../utils/logCategoryLabels";

import { TurnLogCitizenCombobox } from "./TurnLogCitizenCombobox";

import type { TurnLogBrowserFilter } from "../../queries/turnLogBrowserQueries";
import type { JSX } from "react";

type TurnLogFiltersProps = {
  readonly fixedFilter: TurnLogBrowserFilter;
  readonly filter: TurnLogBrowserFilter;
  readonly onFilterChange: (next: TurnLogBrowserFilter) => void;
  readonly worldId: string;
};

// ---------------------------------------------------------------------------
// Active-filter chips
// ---------------------------------------------------------------------------

type FilterChip = {
  readonly key: keyof TurnLogBrowserFilter;
  readonly label: string;
};

function FilterChips({
  chips,
  onRemove,
}: {
  readonly chips: readonly FilterChip[];
  readonly onRemove: (key: keyof TurnLogBrowserFilter) => void;
}): JSX.Element | null {
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {chips.map((chip) => (
        <Badge key={chip.key} variant="secondary" className="gap-1 pr-1">
          {chip.label}
          <button
            type="button"
            aria-label={`Remove ${chip.label} filter`}
            onClick={() => onRemove(chip.key)}
            className="rounded-full hover:bg-foreground/10"
          >
            <X className="size-3" />
          </button>
        </Badge>
      ))}
    </div>
  );
}

export function TurnLogFilters({
  fixedFilter,
  filter,
  onFilterChange,
  worldId,
}: TurnLogFiltersProps): JSX.Element {
  const [open, setOpen] = useState(false);

  function set(patch: Partial<TurnLogBrowserFilter>): void {
    onFilterChange({ ...filter, ...patch });
  }

  function parseOptionalInt(val: string): number | undefined {
    const n = parseInt(val, 10);
    return Number.isFinite(n) ? n : undefined;
  }

  const showSettlement = fixedFilter.settlementId === undefined;
  const showNation =
    fixedFilter.nationId === undefined &&
    fixedFilter.settlementId === undefined;
  const showCitizen = fixedFilter.citizenId === undefined;
  const showResource = fixedFilter.resourceId === undefined;

  const settlementsQuery = useQuery(settlementsByWorldQueryOptions(worldId));
  const nationsQuery = useQuery(nationsListQueryOptions(worldId));
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));
  const citizenQuery = useQuery({
    ...citizenByIdQueryOptions(filter.citizenId ?? ""),
    enabled: filter.citizenId !== undefined,
  });

  const settlements = settlementsQuery.data ?? [];
  const nations = nationsQuery.data ?? [];
  const resources = resourcesQuery.data ?? [];

  const activeCount = Object.values(filter).filter(
    (value) => value !== undefined,
  ).length;

  const chips: FilterChip[] = [];
  if (filter.logCategory !== undefined) {
    chips.push({
      key: "logCategory",
      label: logCategoryLabel(filter.logCategory),
    });
  }
  if (filter.turnFrom !== undefined) {
    chips.push({ key: "turnFrom", label: `Turn ≥ ${filter.turnFrom}` });
  }
  if (filter.turnTo !== undefined) {
    chips.push({ key: "turnTo", label: `Turn ≤ ${filter.turnTo}` });
  }
  if (filter.settlementId !== undefined) {
    const name = settlements.find((s) => s.id === filter.settlementId)?.name;
    chips.push({ key: "settlementId", label: name ?? "Settlement" });
  }
  if (filter.nationId !== undefined) {
    const name = nations.find((n) => n.id === filter.nationId)?.name;
    chips.push({ key: "nationId", label: name ?? "Nation" });
  }
  if (filter.citizenId !== undefined) {
    chips.push({
      key: "citizenId",
      label: citizenQuery.data?.name ?? "Citizen",
    });
  }
  if (filter.resourceId !== undefined) {
    const name = resources.find((r) => r.id === filter.resourceId)?.name;
    chips.push({ key: "resourceId", label: name ?? "Resource" });
  }

  function removeChip(key: keyof TurnLogBrowserFilter): void {
    set({ [key]: undefined });
  }

  return (
    <div className="flex flex-wrap items-start gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" aria-expanded={open}>
            Filters
            {activeCount > 0 ? (
              <Badge variant="default" className="ml-1">
                {activeCount}
              </Badge>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto max-w-none p-3">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {/* Category */}
            <div className="col-span-2 flex flex-col gap-1">
              <Label htmlFor="tlb-category" className="text-xs">
                Category
              </Label>
              <NativeSelect
                id="tlb-category"
                value={filter.logCategory ?? ""}
                onChange={(e) =>
                  set({
                    logCategory:
                      e.target.value !== "" ? e.target.value : undefined,
                  })
                }
                className="h-8 text-sm"
              >
                <option value="">All categories</option>
                {LOG_CODES.map((cat) => (
                  <option key={cat} value={cat}>
                    {LOG_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </NativeSelect>
            </div>

            {/* Turn from */}
            <div className="flex flex-col gap-1">
              <Label htmlFor="tlb-turn-from" className="text-xs">
                Turn from
              </Label>
              <Input
                id="tlb-turn-from"
                type="number"
                min={1}
                placeholder="1"
                value={filter.turnFrom ?? ""}
                onChange={(e) =>
                  set({ turnFrom: parseOptionalInt(e.target.value) })
                }
                className="h-8 text-sm"
              />
            </div>

            {/* Turn to */}
            <div className="flex flex-col gap-1">
              <Label htmlFor="tlb-turn-to" className="text-xs">
                Turn to
              </Label>
              <Input
                id="tlb-turn-to"
                type="number"
                min={1}
                placeholder="Latest"
                value={filter.turnTo ?? ""}
                onChange={(e) =>
                  set({ turnTo: parseOptionalInt(e.target.value) })
                }
                className="h-8 text-sm"
              />
            </div>

            {/* Settlement — hidden when fixed */}
            {showSettlement ? (
              <div className="flex flex-col gap-1">
                <Label htmlFor="tlb-settlement" className="text-xs">
                  Settlement
                </Label>
                <NativeSelect
                  id="tlb-settlement"
                  value={filter.settlementId ?? ""}
                  onChange={(e) =>
                    set({
                      settlementId:
                        e.target.value !== "" ? e.target.value : undefined,
                    })
                  }
                  className="h-8 text-sm"
                >
                  <option value="">All settlements</option>
                  {settlements.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ) : null}

            {/* Nation — hidden when fixed */}
            {showNation ? (
              <div className="flex flex-col gap-1">
                <Label htmlFor="tlb-nation" className="text-xs">
                  Nation
                </Label>
                <NativeSelect
                  id="tlb-nation"
                  value={filter.nationId ?? ""}
                  onChange={(e) =>
                    set({
                      nationId:
                        e.target.value !== "" ? e.target.value : undefined,
                    })
                  }
                  className="h-8 text-sm"
                >
                  <option value="">All nations</option>
                  {nations.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ) : null}

            {/* Citizen — hidden when fixed */}
            {showCitizen ? (
              <div className="flex flex-col gap-1">
                <Label htmlFor="tlb-citizen" className="text-xs">
                  Citizen
                </Label>
                <TurnLogCitizenCombobox
                  citizenId={filter.citizenId}
                  id="tlb-citizen"
                  onChange={(citizenId) => set({ citizenId })}
                  worldId={worldId}
                />
              </div>
            ) : null}

            {/* Resource — hidden when fixed */}
            {showResource ? (
              <div className="flex flex-col gap-1">
                <Label htmlFor="tlb-resource" className="text-xs">
                  Resource
                </Label>
                <NativeSelect
                  id="tlb-resource"
                  value={filter.resourceId ?? ""}
                  onChange={(e) =>
                    set({
                      resourceId:
                        e.target.value !== "" ? e.target.value : undefined,
                    })
                  }
                  className="h-8 text-sm"
                >
                  <option value="">All resources</option>
                  {resources.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </NativeSelect>
              </div>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>

      <FilterChips chips={chips} onRemove={removeChip} />
    </div>
  );
}
