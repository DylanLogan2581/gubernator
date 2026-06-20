import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { Citizen, DeathCauseCategory } from "../../types/citizenTypes";
import type { JSX } from "react";

export function Readout({
  block,
  label,
  mono,
  tooltip,
  value,
}: {
  readonly block?: boolean;
  readonly label: string;
  readonly mono?: boolean;
  readonly tooltip?: string;
  readonly value: string | null;
}): JSX.Element {
  return (
    <div
      className={`rounded-md border border-border bg-background px-3 py-2 ${
        block === true ? "sm:col-span-2" : ""
      }`}
    >
      <dt className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {tooltip !== undefined ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={tooltip}
                className="inline-flex items-center"
              >
                <Info aria-hidden="true" className="size-3" />
              </button>
            </TooltipTrigger>
            <TooltipContent>{tooltip}</TooltipContent>
          </Tooltip>
        ) : null}
      </dt>
      <dd
        className={`text-sm ${mono === true ? "font-mono text-xs" : ""} ${
          block === true ? "whitespace-pre-wrap" : ""
        }`}
      >
        {value === null || value === "" ? (
          <span className="italic text-muted-foreground">Not set</span>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}

export function StatusChip({
  status,
}: {
  readonly status: Citizen["status"];
}): JSX.Element {
  const tone =
    status === "alive"
      ? "bg-secondary text-secondary-foreground"
      : "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center rounded-sm px-2 py-0.5 text-xs ${tone}`}
    >
      {status === "alive" ? "Alive" : "Deceased"}
    </span>
  );
}

export function TypeChip({
  citizenType,
}: {
  readonly citizenType: Citizen["citizenType"];
}): JSX.Element {
  return (
    <span className="inline-flex items-center rounded-sm bg-muted px-2 py-0.5 text-xs text-muted-foreground">
      {citizenType === "npc" ? "NPC" : "Player character"}
    </span>
  );
}

const DEATH_CATEGORY_LABELS: Record<DeathCauseCategory, string> = {
  event: "Event",
  homeless: "Homeless",
  manual_admin: "Admin",
  starvation: "Starvation",
  unknown: "Unknown",
};

export function DeathCategoryChip({
  category,
}: {
  readonly category: DeathCauseCategory;
}): JSX.Element {
  return (
    <span className="inline-flex items-center rounded-sm bg-destructive/15 px-2 py-0.5 text-xs text-destructive">
      {DEATH_CATEGORY_LABELS[category]}
    </span>
  );
}
