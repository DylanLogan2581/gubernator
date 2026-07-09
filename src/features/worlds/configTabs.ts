import {
  Briefcase,
  Building2,
  CalendarDays,
  GraduationCap,
  Gem,
  ImageIcon,
  Landmark,
  PawPrint,
  Package,
  ScrollText,
  Settings,
  Sparkles,
  Swords,
  Tag,
  Users,
} from "lucide-react";

import type { LucideIcon } from "lucide-react";

// Single source of truth for the world configuration tabs. Consumed by the
// sidebar submenu (desktop + mobile nav), the mobile select, and the
// configuration route's `?tab=` search validation — do not duplicate this
// list elsewhere.
export const CONFIG_TABS = [
  { id: "resources", label: "Resources", icon: Package },
  { id: "jobs", label: "Jobs", icon: Briefcase },
  { id: "buildings", label: "Buildings", icon: Building2 },
  { id: "deposits", label: "Deposits", icon: Gem },
  { id: "managed-populations", label: "Managed Populations", icon: PawPrint },
  { id: "cultures-religions", label: "Cultures & Religions", icon: Landmark },
  { id: "education", label: "Education", icon: GraduationCap },
  { id: "military", label: "Military", icon: Swords },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "namesets", label: "Namesets", icon: Tag },
  { id: "discovery", label: "Discovery", icon: Users },
  { id: "offices", label: "Offices", icon: Landmark },
  { id: "npc-flavor", label: "NPC Flavor", icon: Sparkles },
  { id: "population-rules", label: "Population Rules", icon: ScrollText },
  { id: "images", label: "Images", icon: ImageIcon },
  {
    id: "world-settings",
    label: "World Settings",
    icon: Settings,
    superAdminOnly: true,
  },
] as const satisfies readonly {
  readonly id: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly superAdminOnly?: boolean;
}[];

export type ConfigTabId = (typeof CONFIG_TABS)[number]["id"];

export type ConfigTab = (typeof CONFIG_TABS)[number];

export const CONFIG_TAB_IDS = CONFIG_TABS.map((tab) => tab.id) as [
  ConfigTabId,
  ...ConfigTabId[],
];

export const DEFAULT_CONFIG_TAB: ConfigTabId = "resources";

export function getVisibleConfigTabs(
  isSuperAdmin: boolean,
): readonly ConfigTab[] {
  return isSuperAdmin
    ? CONFIG_TABS
    : CONFIG_TABS.filter(
        (tab) => !("superAdminOnly" in tab) || tab.superAdminOnly !== true,
      );
}
