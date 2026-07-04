import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import {
  ArrowLeftRight,
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  Clock,
  FileText,
  Gem,
  Globe2,
  HardHat,
  Landmark,
  LayoutDashboard,
  MapPin,
  Package,
  PawPrint,
  Settings,
  ShieldCheck,
  TrendingUp,
  UserCircle2,
  Users,
} from "lucide-react";

import { Sidebar, SidebarContent, SidebarRail } from "@/components/ui/sidebar";
import { unreadNotificationsCountQueryOptions } from "@/features/notifications";
import {
  useActivePlayerCharacter,
  useEffectiveCanAdmin,
} from "@/features/permissions";

import { CharacterCard } from "./sidebar/CharacterCard";
import { ConfigurationNavItem } from "./sidebar/ConfigurationNavItem";
import { NationScopeSwitcher } from "./sidebar/NationScopeSwitcher";
import { NavGroup, type NavGroupItem } from "./sidebar/NavGroup";
import { SettlementScopeSwitcher } from "./sidebar/SettlementScopeSwitcher";
import { useAppShellWorldContext } from "./sidebar/UseAppShellWorldContext";
import { WorldHeaderCard } from "./sidebar/WorldHeaderCard";
import { useWorldScope } from "./sidebar/WorldScopeContext";

import type { SettlementSection } from "./sidebar/SettlementScopeSwitcher";
import type { JSX } from "react";

// Renders nothing for signed-out visitors (marketing/sign-in pages) — the
// app shell sidebar only applies to authenticated routes. AppLayout mounts
// this unconditionally so the SidebarProvider/SidebarInset shape stays
// constant across the auth-pending -> resolved transition (avoiding a
// remount of routed page content); this component itself opts out instead.
export function AppSidebar(): JSX.Element | null {
  const location = useLocation();
  const {
    canAdmin,
    isAuthenticated,
    isSuperAdmin,
    turnLabel,
    userId,
    worldId,
    worldName,
  } = useAppShellWorldContext();
  const { activeCharacter } = useActivePlayerCharacter();
  const { nationId, settlementId } = useWorldScope();
  const effectiveCanAdmin = useEffectiveCanAdmin(canAdmin);
  // Account-level superadmin nav is suppressed the same way world-admin nav
  // is: an active PC means the viewer is playing, not administering.
  const effectiveIsSuperAdmin = useEffectiveCanAdmin(isSuperAdmin);

  const unreadCountQuery = useQuery(
    unreadNotificationsCountQueryOptions(userId),
  );
  const unreadCount = unreadCountQuery.data ?? 0;

  if (!isAuthenticated) {
    return null;
  }

  const adminItems: NavGroupItem[] = effectiveIsSuperAdmin
    ? [
        {
          key: "superadmin",
          label: "Superadmin",
          isActive: location.pathname === "/superadmin",
          link: (
            <Link to="/superadmin">
              <ShieldCheck aria-hidden="true" />
              <span>Superadmin</span>
            </Link>
          ),
        },
        {
          key: "template-library",
          label: "Template Library",
          isActive: location.pathname === "/superadmin/templates",
          link: (
            <Link to="/superadmin/templates">
              <BookOpen aria-hidden="true" />
              <span>Template Library</span>
            </Link>
          ),
        },
      ]
    : [];

  if (worldId === null) {
    return (
      <Sidebar collapsible="icon" variant="inset">
        <WorldHeaderCard turnLabel={null} worldId={null} worldName={null} />
        <SidebarContent>
          <NavGroup
            label="PLAY"
            items={[
              {
                key: "worlds",
                label: "Worlds",
                isActive: location.pathname === "/worlds",
                link: (
                  <Link to="/worlds">
                    <Globe2 aria-hidden="true" />
                    <span>Worlds</span>
                  </Link>
                ),
              },
              {
                key: "notifications",
                label: "Notifications",
                isActive: location.pathname === "/notifications",
                badge: unreadCount,
                link: (
                  <Link to="/notifications">
                    <Bell aria-hidden="true" />
                    <span>Notifications</span>
                  </Link>
                ),
              },
            ]}
          />
          <NavGroup label="ADMIN" items={adminItems} />
        </SidebarContent>
        <SidebarRail />
      </Sidebar>
    );
  }

  // The SETTLEMENT group's sub-items only make sense while the viewer is
  // actually on the pinned settlement's route — pinned scope can persist
  // (localStorage) across pages like Dashboard/Events where there's no
  // settlement child route to read a section from, and without this guard
  // those pages would otherwise render "Overview" as active by accident (no
  // section === null section fallback).
  const settlementBasePath =
    nationId !== null && settlementId !== null
      ? `/worlds/${worldId}/nations/${nationId}/settlements/${settlementId}`
      : null;
  const isOnSettlementPage =
    settlementBasePath !== null &&
    (location.pathname === settlementBasePath ||
      location.pathname.startsWith(`${settlementBasePath}/`));
  const currentSection =
    isOnSettlementPage && settlementBasePath !== null
      ? sectionFromPathname(location.pathname, settlementBasePath)
      : null;

  const playItems: NavGroupItem[] = [
    {
      key: "dashboard",
      label: "Dashboard",
      isActive: location.pathname === `/worlds/${worldId}`,
      link: (
        <Link to="/worlds/$worldId" params={{ worldId }}>
          <LayoutDashboard aria-hidden="true" />
          <span>Dashboard</span>
        </Link>
      ),
    },
    ...(activeCharacter === null
      ? []
      : [
          {
            key: "my-character",
            label: "My Character",
            isActive:
              location.pathname ===
              `/worlds/${worldId}/citizens/${activeCharacter.id}`,
            link: (
              <Link
                to="/worlds/$worldId/citizens/$citizenId"
                params={{ citizenId: activeCharacter.id, worldId }}
              >
                <UserCircle2 aria-hidden="true" />
                <span>My Character</span>
              </Link>
            ),
          },
        ]),
    {
      key: "events",
      label: "Events",
      isActive: location.pathname.startsWith(`/worlds/${worldId}/events`),
      link: (
        <Link to="/worlds/$worldId/events" params={{ worldId }}>
          <CalendarDays aria-hidden="true" />
          <span>Events</span>
        </Link>
      ),
    },
    {
      key: "notifications",
      label: "Notifications",
      isActive: location.pathname === "/notifications",
      badge: unreadCount,
      link: (
        <Link to="/notifications">
          <Bell aria-hidden="true" />
          <span>Notifications</span>
        </Link>
      ),
    },
  ];

  // No resolvable scope (fresh admin, no pin, no PC home settlement) ->
  // collapse to a single entry pointing at the nations list, where a
  // settlement can be picked (docs/ui-redesign.md §3.2).
  const settlementItems: NavGroupItem[] =
    settlementId === null || nationId === null
      ? [
          {
            key: "settlement-choose",
            label: "Choose a settlement…",
            isActive: false,
            link: (
              <Link to="/worlds/$worldId/nations" params={{ worldId }}>
                <MapPin aria-hidden="true" />
                <span>Choose a settlement…</span>
              </Link>
            ),
          },
        ]
      : [
          settlementSectionItem("overview", {
            isActive: currentSection === "overview",
            label: "Overview",
            nationId,
            settlementId,
            worldId,
          }),
          settlementSectionItem("citizens", {
            isActive: currentSection === "citizens",
            label: "Citizens",
            nationId,
            settlementId,
            worldId,
          }),
          settlementSectionItem("populations", {
            isActive: currentSection === "populations",
            label: "Populations",
            nationId,
            settlementId,
            worldId,
          }),
          settlementSectionItem("buildings", {
            isActive: currentSection === "buildings",
            label: "Buildings",
            nationId,
            settlementId,
            worldId,
          }),
          settlementSectionItem("construction", {
            isActive: currentSection === "construction",
            label: "Construction",
            nationId,
            settlementId,
            worldId,
          }),
          settlementSectionItem("stockpiles", {
            isActive: currentSection === "stockpiles",
            label: "Stockpiles",
            nationId,
            settlementId,
            worldId,
          }),
          settlementSectionItem("deposits", {
            isActive: currentSection === "deposits",
            label: "Deposits",
            nationId,
            settlementId,
            worldId,
          }),
          settlementSectionItem("trade", {
            isActive: currentSection === "trade",
            label: "Trade",
            nationId,
            settlementId,
            worldId,
          }),
          settlementSectionItem("forecast", {
            isActive: currentSection === "forecast",
            label: "Forecast",
            nationId,
            settlementId,
            worldId,
          }),
          settlementSectionItem("reports", {
            isActive: currentSection === "reports",
            label: "Reports",
            nationId,
            settlementId,
            worldId,
          }),
          settlementSectionItem("history", {
            isActive: currentSection === "history",
            label: "History",
            nationId,
            settlementId,
            worldId,
          }),
          ...(effectiveCanAdmin
            ? [
                settlementSectionItem("settings", {
                  isActive: currentSection === "settings",
                  label: "Settings",
                  nationId,
                  settlementId,
                  worldId,
                }),
              ]
            : []),
        ];

  // No resolvable nation -> collapse to a single entry pointing at the
  // nations list (mirrors settlementItems above).
  const nationItems: NavGroupItem[] =
    nationId === null
      ? [
          {
            key: "nation-choose",
            label: "Choose a nation…",
            isActive: false,
            link: (
              <Link to="/worlds/$worldId/nations" params={{ worldId }}>
                <Landmark aria-hidden="true" />
                <span>Choose a nation…</span>
              </Link>
            ),
          },
        ]
      : [
          {
            key: "nation-overview",
            label: "Overview",
            isActive:
              location.pathname === `/worlds/${worldId}/nations/${nationId}`,
            link: (
              <Link
                to="/worlds/$worldId/nations/$nationId"
                params={{ nationId, worldId }}
              >
                <Landmark aria-hidden="true" />
                <span>Overview</span>
              </Link>
            ),
          },
        ];

  const worldItems: NavGroupItem[] = [
    {
      key: "nations",
      label: "Nations",
      isActive: location.pathname === `/worlds/${worldId}/nations`,
      link: (
        <Link to="/worlds/$worldId/nations" params={{ worldId }}>
          <Landmark aria-hidden="true" />
          <span>Nations</span>
        </Link>
      ),
    },
    {
      key: "turn-log",
      label: "Turn Log",
      isActive: location.pathname === `/worlds/${worldId}/history`,
      link: (
        <Link to="/worlds/$worldId/history" params={{ worldId }}>
          <Clock aria-hidden="true" />
          <span>Turn Log</span>
        </Link>
      ),
    },
  ];

  return (
    <Sidebar collapsible="icon" variant="inset">
      <WorldHeaderCard
        turnLabel={turnLabel}
        worldId={worldId}
        worldName={worldName}
      />
      <CharacterCard canAdmin={canAdmin} worldId={worldId} />
      <SidebarContent>
        <NavGroup label="PLAY" items={playItems} />
        <NavGroup
          label="SETTLEMENT"
          items={settlementItems}
          labelSlot={
            <SettlementScopeSwitcher
              section={currentSection}
              settlementId={settlementId}
              worldId={worldId}
            />
          }
        />
        <NavGroup
          label="NATION"
          items={nationItems}
          labelSlot={
            <NationScopeSwitcher nationId={nationId} worldId={worldId} />
          }
        />
        <NavGroup label="WORLD" items={worldItems} />
        {effectiveCanAdmin ? (
          <ConfigurationNavItem
            isSuperAdmin={effectiveIsSuperAdmin}
            worldId={worldId}
          />
        ) : null}
        <NavGroup label="ADMIN" items={adminItems} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}

const SETTLEMENT_SECTION_SEGMENTS: ReadonlySet<string> = new Set<
  Exclude<SettlementSection, "overview">
>([
  "buildings",
  "citizens",
  "construction",
  "deposits",
  "forecast",
  "history",
  "populations",
  "reports",
  "settings",
  "stockpiles",
  "trade",
]);

function isSettlementSectionSegment(
  value: string,
): value is Exclude<SettlementSection, "overview"> {
  return SETTLEMENT_SECTION_SEGMENTS.has(value);
}

// Derives the active SETTLEMENT sidebar item from the pathname suffix past
// the settlement's base route — mirrors the settlement detail child routes
// 1:1. An unrecognized suffix (e.g. mid-navigation to a not-yet-generated
// route) falls back to "overview" rather than leaving the group with no
// active item.
function sectionFromPathname(
  pathname: string,
  settlementBasePath: string,
): SettlementSection {
  const suffix = pathname.slice(settlementBasePath.length);
  const segment = suffix.startsWith("/") ? suffix.slice(1) : suffix;
  return segment !== "" && isSettlementSectionSegment(segment)
    ? segment
    : "overview";
}

function settlementSectionItem(
  section: SettlementSection,
  {
    isActive,
    label,
    nationId,
    settlementId,
    worldId,
  }: {
    readonly isActive: boolean;
    readonly label: string;
    readonly nationId: string;
    readonly settlementId: string;
    readonly worldId: string;
  },
): NavGroupItem {
  const icons: Record<SettlementSection, JSX.Element> = {
    buildings: <Building2 aria-hidden="true" />,
    citizens: <Users aria-hidden="true" />,
    construction: <HardHat aria-hidden="true" />,
    deposits: <Gem aria-hidden="true" />,
    forecast: <TrendingUp aria-hidden="true" />,
    history: <Clock aria-hidden="true" />,
    overview: <LayoutDashboard aria-hidden="true" />,
    populations: <PawPrint aria-hidden="true" />,
    reports: <FileText aria-hidden="true" />,
    settings: <Settings aria-hidden="true" />,
    stockpiles: <Package aria-hidden="true" />,
    trade: <ArrowLeftRight aria-hidden="true" />,
  };

  switch (section) {
    case "overview":
      return {
        key: "settlement-overview",
        label,
        isActive,
        link: (
          <Link
            to="/worlds/$worldId/nations/$nationId/settlements/$settlementId"
            params={{ nationId, settlementId, worldId }}
          >
            {icons[section]}
            <span>{label}</span>
          </Link>
        ),
      };
    case "citizens":
      return {
        key: "settlement-citizens",
        label,
        isActive,
        link: (
          <Link
            to="/worlds/$worldId/nations/$nationId/settlements/$settlementId/citizens"
            params={{ nationId, settlementId, worldId }}
          >
            {icons[section]}
            <span>{label}</span>
          </Link>
        ),
      };
    case "populations":
      return {
        key: "settlement-populations",
        label,
        isActive,
        link: (
          <Link
            to="/worlds/$worldId/nations/$nationId/settlements/$settlementId/populations"
            params={{ nationId, settlementId, worldId }}
          >
            {icons[section]}
            <span>{label}</span>
          </Link>
        ),
      };
    case "buildings":
      return {
        key: "settlement-buildings",
        label,
        isActive,
        link: (
          <Link
            to="/worlds/$worldId/nations/$nationId/settlements/$settlementId/buildings"
            params={{ nationId, settlementId, worldId }}
          >
            {icons[section]}
            <span>{label}</span>
          </Link>
        ),
      };
    case "construction":
      return {
        key: "settlement-construction",
        label,
        isActive,
        link: (
          <Link
            to="/worlds/$worldId/nations/$nationId/settlements/$settlementId/construction"
            params={{ nationId, settlementId, worldId }}
          >
            {icons[section]}
            <span>{label}</span>
          </Link>
        ),
      };
    case "stockpiles":
      return {
        key: "settlement-stockpiles",
        label,
        isActive,
        link: (
          <Link
            to="/worlds/$worldId/nations/$nationId/settlements/$settlementId/stockpiles"
            params={{ nationId, settlementId, worldId }}
          >
            {icons[section]}
            <span>{label}</span>
          </Link>
        ),
      };
    case "deposits":
      return {
        key: "settlement-deposits",
        label,
        isActive,
        link: (
          <Link
            to="/worlds/$worldId/nations/$nationId/settlements/$settlementId/deposits"
            params={{ nationId, settlementId, worldId }}
          >
            {icons[section]}
            <span>{label}</span>
          </Link>
        ),
      };
    case "trade":
      return {
        key: "settlement-trade",
        label,
        isActive,
        link: (
          <Link
            to="/worlds/$worldId/nations/$nationId/settlements/$settlementId/trade"
            params={{ nationId, settlementId, worldId }}
          >
            {icons[section]}
            <span>{label}</span>
          </Link>
        ),
      };
    case "forecast":
      return {
        key: "settlement-forecast",
        label,
        isActive,
        link: (
          <Link
            to="/worlds/$worldId/nations/$nationId/settlements/$settlementId/forecast"
            params={{ nationId, settlementId, worldId }}
          >
            {icons[section]}
            <span>{label}</span>
          </Link>
        ),
      };
    case "reports":
      return {
        key: "settlement-reports",
        label,
        isActive,
        link: (
          <Link
            to="/worlds/$worldId/nations/$nationId/settlements/$settlementId/reports"
            params={{ nationId, settlementId, worldId }}
          >
            {icons[section]}
            <span>{label}</span>
          </Link>
        ),
      };
    case "history":
      return {
        key: "settlement-history",
        label,
        isActive,
        link: (
          <Link
            to="/worlds/$worldId/nations/$nationId/settlements/$settlementId/history"
            params={{ nationId, settlementId, worldId }}
          >
            {icons[section]}
            <span>{label}</span>
          </Link>
        ),
      };
    case "settings":
      return {
        key: "settlement-settings",
        label,
        isActive,
        link: (
          <Link
            to="/worlds/$worldId/nations/$nationId/settlements/$settlementId/settings"
            params={{ nationId, settlementId, worldId }}
          >
            {icons[section]}
            <span>{label}</span>
          </Link>
        ),
      };
  }
}
