import { ChevronsUpDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroupLabel,
  SidebarMenuButton,
  useSidebar,
} from "@/components/ui/sidebar";

import type { JSX, ReactNode } from "react";

export type ScopeGroupSwitcherItem = {
  readonly key: string;
  readonly link: ReactNode;
};

export type ScopeGroupSwitcherProps = {
  readonly emptyLabel: string;
  readonly errorLabel: string;
  // Rendered in the collapsed icon rail's trigger button, in place of the
  // (hidden there) group label — see SidebarGroupLabel's
  // `group-data-[collapsible=icon]:opacity-0` in ui/sidebar.tsx.
  readonly icon: ReactNode;
  readonly isError: boolean;
  readonly isPending: boolean;
  readonly items: readonly ScopeGroupSwitcherItem[];
  readonly menuLabel: string;
  readonly title: ReactNode;
  // Plain-text equivalent of `title`, shown as the collapsed rail trigger's
  // tooltip (SidebarMenuButton's `tooltip` prop only accepts a string).
  readonly tooltipLabel: string;
};

// Generic group-label switcher shared by SETTLEMENT and NATION
// (docs/ui-redesign.md §3.2): the group label itself is the DropdownMenu
// trigger. Callers build fully-typed <Link> elements for `items` (mirrors
// NavGroup's `link` prop) so route params/search stay literal at the call
// site instead of being widened to `string` here. In the collapsed icon
// rail, the group label is hidden (see ui/sidebar.tsx SidebarGroupLabel), so
// the trigger swaps to an icon-only SidebarMenuButton with a tooltip showing
// the current scope — same flyout pattern as WorldSwitcher.
export function ScopeGroupSwitcher({
  emptyLabel,
  errorLabel,
  icon,
  isError,
  isPending,
  items,
  menuLabel,
  title,
  tooltipLabel,
}: ScopeGroupSwitcherProps): JSX.Element {
  const { isMobile, state } = useSidebar();
  const isCollapsedRail = state === "collapsed" && !isMobile;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {isCollapsedRail ? (
          <SidebarMenuButton tooltip={tooltipLabel}>{icon}</SidebarMenuButton>
        ) : (
          <SidebarGroupLabel
            asChild
            className="cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <button type="button">
              <span className="truncate">{title}</span>
              <ChevronsUpDown
                className="ml-auto size-4 shrink-0 text-sidebar-foreground/50"
                aria-hidden="true"
              />
            </button>
          </SidebarGroupLabel>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        side={isMobile ? "bottom" : "right"}
        sideOffset={4}
        className="w-56 rounded-lg"
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          {menuLabel}
        </DropdownMenuLabel>
        {isPending ? (
          <DropdownMenuItem disabled>Loading…</DropdownMenuItem>
        ) : isError ? (
          <DropdownMenuItem disabled>{errorLabel}</DropdownMenuItem>
        ) : items.length === 0 ? (
          <DropdownMenuItem disabled>{emptyLabel}</DropdownMenuItem>
        ) : (
          items.map((item) => (
            <DropdownMenuItem key={item.key} asChild className="gap-2">
              {item.link}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
