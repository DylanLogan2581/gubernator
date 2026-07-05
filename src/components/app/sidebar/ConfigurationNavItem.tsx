import { Link, useLocation, useSearch } from "@tanstack/react-router";
import { ChevronRight, Settings2 } from "lucide-react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import { DEFAULT_CONFIG_TAB, getVisibleConfigTabs } from "@/features/worlds";

import type { JSX } from "react";

type ConfigurationNavItemProps = {
  readonly isSuperAdmin: boolean;
  readonly worldId: string;
};

export function ConfigurationNavItem({
  isSuperAdmin,
  worldId,
}: ConfigurationNavItemProps): JSX.Element {
  const location = useLocation();
  const search = useSearch({ strict: false });
  const isOnConfigRoute =
    location.pathname === `/worlds/${worldId}/configuration`;
  const activeTab =
    isOnConfigRoute && typeof search.tab === "string"
      ? search.tab
      : DEFAULT_CONFIG_TAB;
  const visibleTabs = getVisibleConfigTabs(isSuperAdmin);

  return (
    <Collapsible defaultOpen={isOnConfigRoute} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton tooltip="Configuration">
            <Settings2 aria-hidden="true" />
            <span>Configuration</span>
            <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {visibleTabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <SidebarMenuSubItem key={tab.id}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={isOnConfigRoute && activeTab === tab.id}
                  >
                    <Link
                      to="/worlds/$worldId/configuration"
                      params={{ worldId }}
                      search={{ tab: tab.id }}
                    >
                      <TabIcon aria-hidden="true" />
                      <span>{tab.label}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
