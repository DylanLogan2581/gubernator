import { ChevronsUpDown } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarGroupLabel, useSidebar } from "@/components/ui/sidebar";

import type { JSX, ReactNode } from "react";

export type ScopeGroupSwitcherItem = {
  readonly key: string;
  readonly link: ReactNode;
};

export type ScopeGroupSwitcherProps = {
  readonly emptyLabel: string;
  readonly errorLabel: string;
  readonly isError: boolean;
  readonly isPending: boolean;
  readonly items: readonly ScopeGroupSwitcherItem[];
  readonly menuLabel: string;
  readonly title: ReactNode;
};

// Generic group-label switcher shared by SETTLEMENT and NATION
// (docs/ui-redesign.md §3.2): the group label itself is the DropdownMenu
// trigger. Callers build fully-typed <Link> elements for `items` (mirrors
// NavGroup's `link` prop) so route params/search stay literal at the call
// site instead of being widened to `string` here.
export function ScopeGroupSwitcher({
  emptyLabel,
  errorLabel,
  isError,
  isPending,
  items,
  menuLabel,
  title,
}: ScopeGroupSwitcherProps): JSX.Element {
  const { isMobile } = useSidebar();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarGroupLabel
          asChild
          className="cursor-pointer hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <button type="button">
            <span className="truncate">{title}</span>
            <ChevronsUpDown
              className="ml-auto size-3.5 shrink-0 text-sidebar-foreground/50"
              aria-hidden="true"
            />
          </button>
        </SidebarGroupLabel>
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
