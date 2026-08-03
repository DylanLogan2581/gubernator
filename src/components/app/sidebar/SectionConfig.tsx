import { Link } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  Banknote,
  Briefcase,
  Building2,
  Clock,
  Coins,
  FileText,
  Gem,
  HardHat,
  Handshake,
  LayoutDashboard,
  Package,
  PawPrint,
  Percent,
  ScrollText,
  Settings,
  ShieldCheck,
  Swords,
  TrendingUp,
  Users,
} from "lucide-react";

import type { NationSection } from "./NationScopeSwitcher";
import type { NavGroupItem } from "./NavGroup";
import type { SettlementSection } from "./SettlementScopeSwitcher";
import type { JSX, ReactNode } from "react";

// One config row per scoped sidebar item — the render order of a group is the
// table order. `to` carries the literal route id so the shared builder's
// <Link> stays type-checked against the route tree; `adminOnly` gates the
// Settings row behind admin permission. Adding a section is now a single row.
type SectionConfig<Section extends string, RouteId extends string> = {
  readonly adminOnly?: boolean;
  readonly icon: JSX.Element;
  readonly label: string;
  readonly segment: Section;
  readonly to: RouteId;
};

type SettlementSectionRouteId =
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId"
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId/assignments"
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId/buildings"
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId/citizens"
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId/construction"
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId/deposits"
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId/forecast"
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId/government"
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId/history"
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId/populations"
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId/reports"
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId/settings"
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId/stockpiles"
  | "/worlds/$worldId/nations/$nationId/settlements/$settlementId/trade";

type NationSectionRouteId =
  | "/worlds/$worldId/nations/$nationId"
  | "/worlds/$worldId/nations/$nationId/bank"
  | "/worlds/$worldId/nations/$nationId/charter"
  | "/worlds/$worldId/nations/$nationId/government"
  | "/worlds/$worldId/nations/$nationId/military"
  | "/worlds/$worldId/nations/$nationId/relationships"
  | "/worlds/$worldId/nations/$nationId/reports"
  | "/worlds/$worldId/nations/$nationId/settings"
  | "/worlds/$worldId/nations/$nationId/settlements"
  | "/worlds/$worldId/nations/$nationId/taxPolicy"
  | "/worlds/$worldId/nations/$nationId/treasury";

const SETTLEMENT_SECTION_CONFIG: readonly SectionConfig<
  SettlementSection,
  SettlementSectionRouteId
>[] = [
  {
    icon: <LayoutDashboard aria-hidden="true" />,
    label: "Overview",
    segment: "overview",
    to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId",
  },
  {
    icon: <Users aria-hidden="true" />,
    label: "Citizens",
    segment: "citizens",
    to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId/citizens",
  },
  {
    icon: <Briefcase aria-hidden="true" />,
    label: "Job Assignments",
    segment: "assignments",
    to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId/assignments",
  },
  {
    icon: <PawPrint aria-hidden="true" />,
    label: "Populations",
    segment: "populations",
    to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId/populations",
  },
  {
    icon: <ShieldCheck aria-hidden="true" />,
    label: "Government",
    segment: "government",
    to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId/government",
  },
  {
    icon: <Building2 aria-hidden="true" />,
    label: "Buildings",
    segment: "buildings",
    to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId/buildings",
  },
  {
    icon: <HardHat aria-hidden="true" />,
    label: "Construction",
    segment: "construction",
    to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId/construction",
  },
  {
    icon: <Package aria-hidden="true" />,
    label: "Stockpiles",
    segment: "stockpiles",
    to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId/stockpiles",
  },
  {
    icon: <Gem aria-hidden="true" />,
    label: "Deposits",
    segment: "deposits",
    to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId/deposits",
  },
  {
    icon: <ArrowLeftRight aria-hidden="true" />,
    label: "Trade",
    segment: "trade",
    to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId/trade",
  },
  {
    icon: <TrendingUp aria-hidden="true" />,
    label: "Forecast",
    segment: "forecast",
    to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId/forecast",
  },
  {
    icon: <FileText aria-hidden="true" />,
    label: "Reports",
    segment: "reports",
    to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId/reports",
  },
  {
    icon: <Clock aria-hidden="true" />,
    label: "History",
    segment: "history",
    to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId/history",
  },
  {
    adminOnly: true,
    icon: <Settings aria-hidden="true" />,
    label: "Settings",
    segment: "settings",
    to: "/worlds/$worldId/nations/$nationId/settlements/$settlementId/settings",
  },
];

const NATION_SECTION_CONFIG: readonly SectionConfig<
  NationSection,
  NationSectionRouteId
>[] = [
  {
    icon: <LayoutDashboard aria-hidden="true" />,
    label: "Overview",
    segment: "overview",
    to: "/worlds/$worldId/nations/$nationId",
  },
  {
    icon: <Building2 aria-hidden="true" />,
    label: "Settlements",
    segment: "settlements",
    to: "/worlds/$worldId/nations/$nationId/settlements",
  },
  {
    icon: <Handshake aria-hidden="true" />,
    label: "Relationships",
    segment: "relationships",
    to: "/worlds/$worldId/nations/$nationId/relationships",
  },
  {
    icon: <ShieldCheck aria-hidden="true" />,
    label: "Government",
    segment: "government",
    to: "/worlds/$worldId/nations/$nationId/government",
  },
  {
    icon: <ScrollText aria-hidden="true" />,
    label: "Charter",
    segment: "charter",
    to: "/worlds/$worldId/nations/$nationId/charter",
  },
  {
    icon: <Swords aria-hidden="true" />,
    label: "Military",
    segment: "military",
    to: "/worlds/$worldId/nations/$nationId/military",
  },
  {
    icon: <Coins aria-hidden="true" />,
    label: "Treasury",
    segment: "treasury",
    to: "/worlds/$worldId/nations/$nationId/treasury",
  },
  {
    icon: <Banknote aria-hidden="true" />,
    label: "Bank",
    segment: "bank",
    to: "/worlds/$worldId/nations/$nationId/bank",
  },
  {
    icon: <Percent aria-hidden="true" />,
    label: "Tax Policy",
    segment: "taxPolicy",
    to: "/worlds/$worldId/nations/$nationId/taxPolicy",
  },
  {
    icon: <FileText aria-hidden="true" />,
    label: "Reports",
    segment: "reports",
    to: "/worlds/$worldId/nations/$nationId/reports",
  },
  {
    adminOnly: true,
    icon: <Settings aria-hidden="true" />,
    label: "Settings",
    segment: "settings",
    to: "/worlds/$worldId/nations/$nationId/settings",
  },
];

// Segment sets for `sectionFromPathname` — every section except the base
// "overview" (which maps to an empty pathname suffix), derived from the
// config so the parser and the rendered items can never drift apart.
export const SETTLEMENT_SECTION_SEGMENTS: ReadonlySet<SettlementSection> =
  new Set(
    SETTLEMENT_SECTION_CONFIG.map((config) => config.segment).filter(
      (segment) => segment !== "overview",
    ),
  );

export const NATION_SECTION_SEGMENTS: ReadonlySet<NationSection> = new Set(
  NATION_SECTION_CONFIG.map((config) => config.segment).filter(
    (segment) => segment !== "overview",
  ),
);

// Shared builder: one config row + the caller's per-scope <Link> become one
// NavGroupItem. The <Link> is built by the scope helpers below (where `to`
// and `params` are concretely typed together); this only assembles the
// common {key, label, isActive, badge, link} shape.
function sectionNavItem(
  key: string,
  label: string,
  isActive: boolean,
  link: ReactNode,
  badge: number | undefined,
): NavGroupItem {
  return badge === undefined
    ? { isActive, key, label, link }
    : { badge, isActive, key, label, link };
}

export function buildSettlementSectionItems({
  currentSection,
  effectiveCanAdmin,
  governmentBadge,
  nationId,
  settlementId,
  worldId,
}: {
  readonly currentSection: SettlementSection | null;
  readonly effectiveCanAdmin: boolean;
  readonly governmentBadge: number;
  readonly nationId: string;
  readonly settlementId: string;
  readonly worldId: string;
}): NavGroupItem[] {
  const params = { nationId, settlementId, worldId };
  return SETTLEMENT_SECTION_CONFIG.filter(
    (config) => config.adminOnly !== true || effectiveCanAdmin,
  ).map((config) =>
    sectionNavItem(
      `settlement-${config.segment}`,
      config.label,
      currentSection === config.segment,
      <Link to={config.to} params={params}>
        {config.icon}
        <span>{config.label}</span>
      </Link>,
      config.segment === "government" ? governmentBadge : undefined,
    ),
  );
}

export function buildNationSectionItems({
  currentSection,
  effectiveCanAdmin,
  governmentBadge,
  nationId,
  worldId,
}: {
  readonly currentSection: NationSection | null;
  readonly effectiveCanAdmin: boolean;
  readonly governmentBadge: number;
  readonly nationId: string;
  readonly worldId: string;
}): NavGroupItem[] {
  const params = { nationId, worldId };
  return NATION_SECTION_CONFIG.filter(
    (config) => config.adminOnly !== true || effectiveCanAdmin,
  ).map((config) =>
    sectionNavItem(
      `nation-${config.segment}`,
      config.label,
      currentSection === config.segment,
      <Link to={config.to} params={params}>
        {config.icon}
        <span>{config.label}</span>
      </Link>,
      config.segment === "government" ? governmentBadge : undefined,
    ),
  );
}
