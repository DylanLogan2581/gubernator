import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import {
  Bell,
  BookOpen,
  CalendarDays,
  Clock,
  FileText,
  Globe2,
  Landmark,
  LayoutDashboard,
  MapPin,
  Package,
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
  // `?section=` search param to read, and without this guard those pages
  // would otherwise render "Overview" as active by accident (no section ===
  // null section fallback).
  const isOnSettlementPage =
    nationId !== null &&
    settlementId !== null &&
    location.pathname ===
      `/worlds/${worldId}/nations/${nationId}/settlements/${settlementId}`;
  const currentSection = isOnSettlementPage
    ? sectionSearchValue(location.search)
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
          settlementSectionItem({
            isActive:
              isOnSettlementPage &&
              (currentSection === "overview" || currentSection === null),
            label: "Overview",
            nationId,
            section: "overview",
            settlementId,
            worldId,
          }),
          settlementSectionItem({
            isActive: currentSection === "population",
            label: "Population",
            nationId,
            section: "population",
            settlementId,
            worldId,
          }),
          settlementSectionItem({
            isActive: currentSection === "economy",
            label: "Economy",
            nationId,
            section: "economy",
            settlementId,
            worldId,
          }),
          settlementSectionItem({
            isActive: currentSection === "forecast",
            label: "Forecast",
            nationId,
            section: "forecast",
            settlementId,
            worldId,
          }),
          settlementSectionItem({
            isActive: currentSection === "reports",
            label: "Reports",
            nationId,
            section: "reports",
            settlementId,
            worldId,
          }),
          settlementSectionItem({
            isActive: currentSection === "history",
            label: "History",
            nationId,
            section: "history",
            settlementId,
            worldId,
          }),
          ...(effectiveCanAdmin
            ? [
                settlementSectionItem({
                  isActive: currentSection === "admin",
                  label: "Admin",
                  nationId,
                  section: "admin",
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

const SETTLEMENT_SECTIONS: ReadonlySet<string> = new Set<SettlementSection>([
  "admin",
  "economy",
  "forecast",
  "history",
  "overview",
  "population",
  "reports",
]);

function isSettlementSection(value: string): value is SettlementSection {
  return SETTLEMENT_SECTIONS.has(value);
}

function sectionSearchValue(search: unknown): SettlementSection | null {
  if (typeof search !== "object" || search === null) {
    return null;
  }
  const value = (search as Record<string, unknown>).section;
  return typeof value === "string" && isSettlementSection(value) ? value : null;
}

function settlementSectionItem({
  isActive,
  label,
  nationId,
  section,
  settlementId,
  worldId,
}: {
  readonly isActive: boolean;
  readonly label: string;
  readonly nationId: string;
  readonly section: SettlementSection;
  readonly settlementId: string;
  readonly worldId: string;
}): NavGroupItem {
  const icons: Record<SettlementSection, JSX.Element> = {
    admin: <ShieldCheck aria-hidden="true" />,
    economy: <Package aria-hidden="true" />,
    forecast: <TrendingUp aria-hidden="true" />,
    history: <Clock aria-hidden="true" />,
    overview: <LayoutDashboard aria-hidden="true" />,
    population: <Users aria-hidden="true" />,
    reports: <FileText aria-hidden="true" />,
  };

  return {
    key: `settlement-${section}`,
    label,
    isActive,
    link: (
      <Link
        to="/worlds/$worldId/nations/$nationId/settlements/$settlementId"
        params={{ nationId, settlementId, worldId }}
        search={{ section }}
      >
        {icons[section]}
        <span>{label}</span>
      </Link>
    ),
  };
}
