import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

import type { JSX, ReactNode } from "react";

export type NavGroupItem = {
  readonly badge?: number;
  readonly isActive: boolean;
  readonly key: string;
  readonly label: string;
  readonly link: ReactNode;
};

type NavGroupProps = {
  readonly items: readonly NavGroupItem[];
  readonly label: string;
  // Overrides the plain-text label with a custom element (e.g. a
  // DropdownMenu-trigger switcher) while keeping the rest of the group's
  // rendering — used by the SETTLEMENT/NATION scope switchers.
  readonly labelSlot?: ReactNode;
};

// Renders one labelled sidebar section (PLAY / SETTLEMENT / NATION / WORLD /
// ADMIN). `link` is a fully-built <Link> element from the caller so route
// `to`/`params`/`search` stay literal and type-checked at the call site
// instead of being widened to `string` by a generic prop here.
export function NavGroup({
  items,
  label,
  labelSlot,
}: NavGroupProps): JSX.Element | null {
  if (items.length === 0) {
    return null;
  }

  return (
    <SidebarGroup>
      {labelSlot ?? <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.key}>
              <SidebarMenuButton
                asChild
                isActive={item.isActive}
                tooltip={item.label}
              >
                {item.link}
              </SidebarMenuButton>
              {item.badge !== undefined && item.badge > 0 ? (
                <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
              ) : null}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
