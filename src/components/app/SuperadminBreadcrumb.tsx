import { Link, useLocation } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";

import type { JSX } from "react";

const SUPERADMIN_SECTION_LABELS: Record<string, string> = {
  "/superadmin/users": "Users",
  "/superadmin/worlds": "Worlds",
  "/superadmin/transitions": "Stuck Transitions",
  "/superadmin/templates": "Template Library",
  "/superadmin/email": "Email",
};

// Mirrors WorldBreadcrumb's structure for the non-world superadmin
// routes — kept separate since the segment logic here is trivial (no
// queries) and doesn't need buildSegments' world/nation/settlement/citizen
// depth handling.
export function SuperadminBreadcrumb(): JSX.Element {
  const location = useLocation();
  const sectionLabel = SUPERADMIN_SECTION_LABELS[location.pathname];
  const hasSectionLabel = sectionLabel !== undefined;

  return (
    <nav aria-label="Superadmin navigation breadcrumb">
      <ol className="flex min-w-0 items-center gap-1">
        <li className="flex shrink-0 items-center gap-1">
          {hasSectionLabel ? (
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
        {hasSectionLabel ? (
          <li className="flex min-w-0 items-center gap-1">
            <ChevronRight aria-hidden="true" className="size-3 opacity-50" />
            <span>{sectionLabel}</span>
          </li>
        ) : null}
      </ol>
    </nav>
  );
}
