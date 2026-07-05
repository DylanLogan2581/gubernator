// Shared "linked entity name" cell — a Link to the entity's page plus a
// HoverCard hint, or plain muted text when the entity has no dedicated page
// or hasn't resolved yet. Used by the Scope column and by payload renderers
// so every id surfaced to the user reads as a name, never a raw UUID.

import { Link } from "@tanstack/react-router";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";

import type { JSX, ReactNode } from "react";

type EntityRefProps = {
  /** Resolved display name; null while the batch lookup is still loading. */
  readonly name: string | null;
  /** App-internal path, e.g. `/worlds/{worldId}/citizens/{citizenId}`. Null
   *  when the entity has no dedicated page to link to. */
  readonly href: string | null;
  /** Short kind label shown in the hover card, e.g. "Citizen". */
  readonly kindLabel: string;
  /** Extra hover card content beyond the kind label (e.g. a status line). */
  readonly hint?: ReactNode;
};

export function EntityRef({
  name,
  href,
  kindLabel,
  hint,
}: EntityRefProps): JSX.Element {
  const label = name ?? `Unknown ${kindLabel.toLowerCase()}`;

  if (href === null) {
    return <span className="text-muted-foreground">{label}</span>;
  }

  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>
        <Link
          to={href}
          className="text-primary underline-offset-2 hover:underline"
        >
          {label}
        </Link>
      </HoverCardTrigger>
      <HoverCardContent className="w-auto max-w-64 text-xs">
        <div className="font-medium">{label}</div>
        <div className="text-muted-foreground">
          {kindLabel}
          {hint !== undefined ? <> · {hint}</> : null}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
