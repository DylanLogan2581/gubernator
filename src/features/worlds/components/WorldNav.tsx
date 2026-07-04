import { Link } from "@tanstack/react-router";
import { CalendarDays, Clock, Globe2, Settings2 } from "lucide-react";

import type { JSX } from "react";

type WorldNavProps = {
  readonly canAdmin: boolean;
  readonly worldId: string;
};

const activeClass = "border-b-2 border-foreground text-foreground";
const inactiveClass =
  "border-b-2 border-transparent text-muted-foreground hover:text-foreground";

export function WorldNav({ canAdmin, worldId }: WorldNavProps): JSX.Element {
  return (
    <nav
      aria-label="World sections"
      className="flex gap-1 border-b border-border"
    >
      <Link
        to="/worlds/$worldId"
        params={{ worldId }}
        activeProps={{ className: activeClass }}
        inactiveProps={{ className: inactiveClass }}
        activeOptions={{ exact: true }}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors"
      >
        <Globe2 className="size-3.5 shrink-0" aria-hidden="true" />
        Overview
      </Link>
      <Link
        to="/worlds/$worldId/events"
        params={{ worldId }}
        activeProps={{ className: activeClass }}
        inactiveProps={{ className: inactiveClass }}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors"
      >
        <CalendarDays className="size-3.5 shrink-0" aria-hidden="true" />
        Events
      </Link>
      <Link
        to="/worlds/$worldId/history"
        params={{ worldId }}
        activeProps={{ className: activeClass }}
        inactiveProps={{ className: inactiveClass }}
        className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors"
      >
        <Clock className="size-3.5 shrink-0" aria-hidden="true" />
        History
      </Link>
      {canAdmin ? (
        <Link
          to="/worlds/$worldId/configuration"
          params={{ worldId }}
          search={{ tab: "resources" }}
          activeProps={{ className: activeClass }}
          inactiveProps={{ className: inactiveClass }}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors"
        >
          <Settings2 className="size-3.5 shrink-0" aria-hidden="true" />
          Configuration
        </Link>
      ) : null}
    </nav>
  );
}
