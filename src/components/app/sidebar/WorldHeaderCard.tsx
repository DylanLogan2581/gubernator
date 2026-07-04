import { Link } from "@tanstack/react-router";
import { Globe2 } from "lucide-react";

import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import type { JSX } from "react";

type WorldHeaderCardProps = {
  readonly turnLabel: string | null;
  readonly worldId: string | null;
  readonly worldName: string | null;
};

// Static world identity header — no switcher dropdown yet (follow-up issue
// per docs/ui-redesign.md §3.2). Falls back to the Gubernator brand for
// out-of-world routes (/worlds, /superadmin, /notifications).
export function WorldHeaderCard({
  turnLabel,
  worldId,
  worldName,
}: WorldHeaderCardProps): JSX.Element {
  if (worldId === null) {
    return (
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild size="lg" tooltip="Gubernator">
              <Link to="/worlds">
                <img
                  src="/logo.png"
                  alt=""
                  className="size-6 rounded-md object-contain"
                />
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-medium">Gubernator</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
    );
  }

  return (
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild size="lg" tooltip={worldName ?? "World"}>
            <Link to="/worlds/$worldId" params={{ worldId }}>
              <Globe2 className="size-4 shrink-0" aria-hidden="true" />
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate font-medium">
                  {worldName ?? "Loading…"}
                </span>
                {turnLabel !== null ? (
                  <span className="truncate text-xs text-sidebar-foreground/70">
                    {turnLabel}
                  </span>
                ) : null}
              </span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
  );
}
