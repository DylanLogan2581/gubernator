// Filter controls for the turn log browser.
// Fields hidden when their value is locked via fixedFilter.

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";

import { LOG_CATEGORY_LABELS } from "../../utils/logCategoryLabels";

import type { TurnLogBrowserFilter } from "../../queries/turnLogBrowserQueries";
import type { JSX } from "react";

// All known log categories in the codebase — for the dropdown.
// Unknown categories still appear via the raw-JSON fallback renderer;
// this list only affects the filter dropdown options.
const LOG_CATEGORIES = [
  "basic_turn_advancement",
  "building.auto_deconstructed",
  "building.recovered",
  "building.suspended",
  "citizen.born",
  "citizen.consumed_food_water",
  "citizen.died_homeless",
  "citizen.starved",
  "construction.completed",
  "construction.paused",
  "construction.progress",
  "deposit.depleted",
  "deposit.processed",
  "event.building_destroyed",
  "event.consumption_multiplier",
  "event.deposit_discovered",
  "event.deposit_destroyed",
  "event.managed_population_change",
  "event.population_boost",
  "event.population_loss",
  "event.production_multiplier",
  "event.resource_drain",
  "event.resource_grant",
  "event.upkeep_multiplier",
  "homeless",
  "managed_population.declining",
  "managed_population.extinct",
  "manual_deconstruct_overshoot",
  "partnership.formed",
  "partnership.widowed",
  "passive_effect.applied",
  "settlement.homelessness_occurred",
  "settlement.starvation_occurred",
  "standard_job.processed",
  "starvation",
  "stockpile.clamped",
  "stockpile.decayed",
  "tampered",
  "trade_route.paused",
  "trade_route.resumed",
] as const;

type TurnLogFiltersProps = {
  readonly fixedFilter: TurnLogBrowserFilter;
  readonly filter: TurnLogBrowserFilter;
  readonly onFilterChange: (next: TurnLogBrowserFilter) => void;
};

export function TurnLogFilters({
  fixedFilter,
  filter,
  onFilterChange,
}: TurnLogFiltersProps): JSX.Element {
  function set(patch: Partial<TurnLogBrowserFilter>): void {
    onFilterChange({ ...filter, ...patch });
  }

  function parseOptionalInt(val: string): number | undefined {
    const n = parseInt(val, 10);
    return Number.isFinite(n) ? n : undefined;
  }

  const showSettlement = fixedFilter.settlementId === undefined;
  const showNation = fixedFilter.nationId === undefined;
  const showCitizen = fixedFilter.citizenId === undefined;
  const showResource = fixedFilter.resourceId === undefined;

  return (
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
              logCategory: e.target.value !== "" ? e.target.value : undefined,
            })
          }
          className="h-8 text-sm"
        >
          <option value="">All categories</option>
          {LOG_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {LOG_CATEGORY_LABELS[cat] ?? cat}
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
          onChange={(e) => set({ turnFrom: parseOptionalInt(e.target.value) })}
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
          placeholder="∞"
          value={filter.turnTo ?? ""}
          onChange={(e) => set({ turnTo: parseOptionalInt(e.target.value) })}
          className="h-8 text-sm"
        />
      </div>

      {/* Settlement ID — hidden when fixed */}
      {showSettlement ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor="tlb-settlement" className="text-xs">
            Settlement ID
          </Label>
          <Input
            id="tlb-settlement"
            type="text"
            placeholder="UUID…"
            value={filter.settlementId ?? ""}
            onChange={(e) =>
              set({
                settlementId:
                  e.target.value !== "" ? e.target.value : undefined,
              })
            }
            className="h-8 font-mono text-xs"
          />
        </div>
      ) : null}

      {/* Nation ID — hidden when fixed */}
      {showNation ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor="tlb-nation" className="text-xs">
            Nation ID
          </Label>
          <Input
            id="tlb-nation"
            type="text"
            placeholder="UUID…"
            value={filter.nationId ?? ""}
            onChange={(e) =>
              set({
                nationId: e.target.value !== "" ? e.target.value : undefined,
              })
            }
            className="h-8 font-mono text-xs"
          />
        </div>
      ) : null}

      {/* Citizen ID — hidden when fixed */}
      {showCitizen ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor="tlb-citizen" className="text-xs">
            Citizen ID
          </Label>
          <Input
            id="tlb-citizen"
            type="text"
            placeholder="UUID…"
            value={filter.citizenId ?? ""}
            onChange={(e) =>
              set({
                citizenId: e.target.value !== "" ? e.target.value : undefined,
              })
            }
            className="h-8 font-mono text-xs"
          />
        </div>
      ) : null}

      {/* Resource ID — hidden when fixed */}
      {showResource ? (
        <div className="flex flex-col gap-1">
          <Label htmlFor="tlb-resource" className="text-xs">
            Resource ID
          </Label>
          <Input
            id="tlb-resource"
            type="text"
            placeholder="UUID…"
            value={filter.resourceId ?? ""}
            onChange={(e) =>
              set({
                resourceId: e.target.value !== "" ? e.target.value : undefined,
              })
            }
            className="h-8 font-mono text-xs"
          />
        </div>
      ) : null}
    </div>
  );
}
