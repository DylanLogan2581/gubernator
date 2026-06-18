// Filter controls for the turn log browser.
// Fields hidden when their value is locked via fixedFilter.

import { useQuery } from "@tanstack/react-query";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { citizensInWorldQueryOptions } from "@/features/citizens";
import { nationsListQueryOptions } from "@/features/nations";
import { activeResourcesByWorldQueryOptions } from "@/features/resources";
import { settlementsByWorldQueryOptions } from "@/features/settlements";

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
  readonly worldId: string;
};

export function TurnLogFilters({
  fixedFilter,
  filter,
  onFilterChange,
  worldId,
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

  const settlementsQuery = useQuery(settlementsByWorldQueryOptions(worldId));
  const nationsQuery = useQuery(nationsListQueryOptions(worldId));
  const citizensQuery = useQuery(citizensInWorldQueryOptions(worldId));
  const resourcesQuery = useQuery(activeResourcesByWorldQueryOptions(worldId));

  const settlements = settlementsQuery.data ?? [];
  const nations = nationsQuery.data ?? [];
  const citizens = citizensQuery.data ?? [];
  const resources = resourcesQuery.data ?? [];

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
                nationId: e.target.value !== "" ? e.target.value : undefined,
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
          <NativeSelect
            id="tlb-citizen"
            value={filter.citizenId ?? ""}
            onChange={(e) =>
              set({
                citizenId: e.target.value !== "" ? e.target.value : undefined,
              })
            }
            className="h-8 text-sm"
          >
            <option value="">All citizens</option>
            {citizens.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
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
                resourceId: e.target.value !== "" ? e.target.value : undefined,
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
  );
}
