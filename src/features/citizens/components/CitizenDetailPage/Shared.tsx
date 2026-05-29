import type { Citizen } from "../../types/citizenTypes";
import type { JSX } from "react";

export function Readout({
  block,
  label,
  mono,
  value,
}: {
  readonly block?: boolean;
  readonly label: string;
  readonly mono?: boolean;
  readonly value: string | null;
}): JSX.Element {
  return (
    <div
      className={`rounded-md border border-border bg-background px-3 py-2 ${
        block === true ? "sm:col-span-2" : ""
      }`}
    >
      <dt className="text-xs text-muted-foreground">{label}</dt>
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
