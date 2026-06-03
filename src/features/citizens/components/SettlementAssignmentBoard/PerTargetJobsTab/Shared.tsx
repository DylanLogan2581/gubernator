import { ChevronDown, X } from "lucide-react";
import { type JSX, type ReactNode } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import type { Citizen } from "../../../types/citizenTypes";

export function CollapsibleSection({
  children,
  title,
}: {
  readonly children: ReactNode;
  readonly title: string;
}): JSX.Element {
  return (
    <Collapsible defaultOpen className="grid gap-2">
      <CollapsibleTrigger className="group flex items-center gap-1 text-left text-sm font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ChevronDown
          aria-hidden="true"
          className="h-4 w-4 shrink-0 -rotate-90 transition-transform group-data-[state=open]:rotate-0"
        />
        {title}
      </CollapsibleTrigger>
      <CollapsibleContent className="grid gap-2">{children}</CollapsibleContent>
    </Collapsible>
  );
}

export function CitizenTags({
  assignedIds,
  canEdit,
  citizenMap,
  isPending,
  labelPrefix,
  onRemove,
}: {
  readonly assignedIds: readonly string[];
  readonly canEdit: boolean;
  readonly citizenMap: ReadonlyMap<string, Citizen>;
  readonly isPending: boolean;
  readonly labelPrefix: string;
  readonly onRemove: (citizenId: string) => void;
}): JSX.Element {
  if (assignedIds.length === 0) {
    return (
      <p className="text-xs italic text-muted-foreground">
        No citizens assigned.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {assignedIds.map((id) => {
        const name = citizenMap.get(id)?.name ?? id;
        return (
          <span
            key={id}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
          >
            {name}
            {canEdit ? (
              <button
                aria-label={`Remove ${name} from ${labelPrefix}`}
                className="text-muted-foreground hover:text-foreground disabled:opacity-50"
                disabled={isPending}
                type="button"
                onClick={() => {
                  onRemove(id);
                }}
              >
                <X aria-hidden="true" className="h-3 w-3" />
              </button>
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

export function TargetRowShell({
  assignButton,
  capacityHint,
  children,
  icon,
  label,
}: {
  readonly assignButton?: ReactNode;
  readonly capacityHint?: string;
  readonly children: ReactNode;
  readonly icon?: ReactNode;
  readonly label: string;
}): JSX.Element {
  return (
    <div className="rounded border border-border bg-background p-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-1.5">
          {icon}
          <span className="text-sm font-medium">{label}</span>
          {capacityHint !== undefined ? (
            <span className="text-xs text-muted-foreground">
              {capacityHint}
            </span>
          ) : null}
        </div>
        {assignButton}
      </div>
      {children}
    </div>
  );
}
