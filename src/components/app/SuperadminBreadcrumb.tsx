import { Link, useLocation } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import type { JSX } from "react";

// Mirrors WorldBreadcrumb's structure for the two non-world superadmin
// routes — kept separate since the segment logic here is trivial (no
// queries) and doesn't need buildSegments' world/nation/settlement/citizen
// depth handling.
export function SuperadminBreadcrumb(): JSX.Element {
  const location = useLocation();
  const onTemplatesPage = location.pathname === "/superadmin/templates";

  return (
    <nav aria-label="Superadmin navigation breadcrumb">
      <ol className="flex min-w-0 items-center gap-1">
        <li className="flex shrink-0 items-center gap-1">
          {onTemplatesPage ? (
            <Link
              to="/superadmin"
              className="transition-colors hover:text-foreground"
            >
              Superadmin
            </Link>
          ) : (
            <span>Superadmin</span>
          )}
        </li>
        {onTemplatesPage ? (
          <li className="flex min-w-0 items-center gap-1">
            <ChevronRight aria-hidden="true" className="size-3 opacity-50" />
            <span>Template Library</span>
          </li>
        ) : null}
      </ol>
    </nav>
  );
}
