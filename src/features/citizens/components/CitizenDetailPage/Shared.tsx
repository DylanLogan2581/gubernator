import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { Citizen, DeathCauseCategory } from "../../types/citizenTypes";
import type { JSX, ReactNode } from "react";

export function Readout({
  block,
  children,
  label,
  mono,
  tooltip,
  value,
}: {
  readonly block?: boolean;
  // Custom content for the value slot (e.g. a chip). Takes precedence over `value`.
  readonly children?: ReactNode;
  readonly label: string;
  readonly mono?: boolean;
  readonly tooltip?: string;
  readonly value?: string | null;
}): JSX.Element {
  return (
    <div
      className={`flex gap-4 py-2.5 ${
        block === true ? "flex-col" : "items-center justify-between"
      }`}
    >
      <dt className="eyebrow flex items-center gap-1">
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
        className={`text-sm font-medium ${
          mono === true ? "font-mono text-xs" : ""
        } ${block === true ? "whitespace-pre-wrap" : "text-right"}`}
      >
        {children !== undefined ? (
          children
        ) : value === null || value === undefined || value === "" ? (
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

export function CultureReligionChip({
  color,
  name,
}: {
  readonly color: string;
  readonly name: string;
}): JSX.Element {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
      <span
        aria-hidden="true"
        className="size-2.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      {name}
    </span>
  );
}
