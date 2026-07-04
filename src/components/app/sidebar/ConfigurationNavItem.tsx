import { Link, useLocation, useSearch } from "@tanstack/react-router";
import {
  Briefcase,
  Building2,
  CalendarDays,
  ChevronRight,
  Gem,
  PawPrint,
  Package,
  Settings,
  Settings2,
  Sparkles,
  Tag,
  ScrollText,
} from "lucide-react";

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

import type { JSX } from "react";

// Mirrors WorldConfigurationPage's BASE_TABS/SUPER_ADMIN_TABS — kept as a
// local literal here (rather than importing route/page internals) since the
// sidebar only needs the stable key/label pairs, not the page's tab logic.
const CONFIGURATION_TABS = [
  { key: "resources", label: "Resources", icon: Package },
  { key: "jobs", label: "Jobs", icon: Briefcase },
  { key: "buildings", label: "Buildings", icon: Building2 },
  { key: "deposits", label: "Deposits", icon: Gem },
  { key: "managed-populations", label: "Managed Populations", icon: PawPrint },
  { key: "calendar", label: "Calendar", icon: CalendarDays },
  { key: "namesets", label: "Namesets", icon: Tag },
  { key: "npc-flavor", label: "NPC Flavor", icon: Sparkles },
  { key: "population-rules", label: "Population Rules", icon: ScrollText },
] as const;

const SUPER_ADMIN_TAB = {
  key: "world-settings",
  label: "World Settings",
  icon: Settings,
} as const;

const DEFAULT_TAB = "resources";

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
      : DEFAULT_TAB;

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
            {CONFIGURATION_TABS.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <SidebarMenuSubItem key={tab.key}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={isOnConfigRoute && activeTab === tab.key}
                  >
                    <Link
                      to="/worlds/$worldId/configuration"
                      params={{ worldId }}
                      search={{ tab: tab.key }}
                    >
                      <TabIcon aria-hidden="true" />
                      <span>{tab.label}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
            {isSuperAdmin ? (
              <SidebarMenuSubItem>
                <SidebarMenuSubButton
                  asChild
                  isActive={
                    isOnConfigRoute && activeTab === SUPER_ADMIN_TAB.key
                  }
                >
                  <Link
                    to="/worlds/$worldId/configuration"
                    params={{ worldId }}
                    search={{ tab: SUPER_ADMIN_TAB.key }}
                  >
                    <SUPER_ADMIN_TAB.icon aria-hidden="true" />
                    <span>{SUPER_ADMIN_TAB.label}</span>
                  </Link>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ) : null}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}
