import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import {
  AlertTriangle,
  Bell,
  BookOpen,
  Clock,
  Globe2,
  Landmark,
  LayoutDashboard,
  Mail,
  MapPin,
  ShieldCheck,
  UserCircle2,
  Users,
  Zap,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { lawAmendmentsAwaitingMyVoteCountQueryOptions } from "@/features/law-amendments";
import { unreadNotificationsCountQueryOptions } from "@/features/notifications";
import {
  useActivePlayerCharacter,
  useEffectiveCanAdmin,
} from "@/features/permissions";

import { CharacterCard } from "./sidebar/CharacterCard";
import { ConfigurationNavItem } from "./sidebar/ConfigurationNavItem";
import { NationScopeSwitcher } from "./sidebar/NationScopeSwitcher";
import { NavGroup, type NavGroupItem } from "./sidebar/NavGroup";
import {
  buildNationSectionItems,
  buildSettlementSectionItems,
  NATION_SECTION_SEGMENTS,
  SETTLEMENT_SECTION_SEGMENTS,
} from "./sidebar/SectionConfig";
import { sectionFromPathname } from "./sidebar/SectionRouting";
import { SettlementScopeSwitcher } from "./sidebar/SettlementScopeSwitcher";
import { useAppShellWorldContext } from "./sidebar/UseAppShellWorldContext";
import { WorldHeaderCard } from "./sidebar/WorldHeaderCard";
import { useWorldScope } from "./sidebar/WorldScopeContext";

import type { JSX } from "react";

// Renders nothing for signed-out visitors (marketing/sign-in pages) — the
// app shell sidebar only applies to authenticated routes. AppLayout mounts
// this unconditionally so the SidebarProvider/SidebarInset shape stays
// constant across the auth-pending -> resolved transition (avoiding a
// remount of routed page content); this component itself opts out instead.
// Prefix-aware active match: exact match, or a descendant route below href.
function isNavPathActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppSidebar(): JSX.Element | null {
  const location = useLocation();
  const {
    isAuthenticated,
    isSuperAdmin,
    sidebarCanAdmin: canAdmin,
    sidebarTurnLabel: turnLabel,
    sidebarWorldId: worldId,
    sidebarWorldName: worldName,
    userId,
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

  // "Awaiting your vote" badges (#1120) -- only for a viewer with an active
  // player character (admins with no PC don't get a personal vote badge).
  // Two separate queries/counts since the NATION and SETTLEMENT groups link
  // to different government tabs.
  const nationAwaitingMyVoteQuery = useQuery({
    ...lawAmendmentsAwaitingMyVoteCountQueryOptions(
      { nationId, settlementId: null },
      activeCharacter?.id ?? "",
    ),
    enabled: nationId !== null && activeCharacter !== null,
  });
  const settlementAwaitingMyVoteQuery = useQuery({
    ...lawAmendmentsAwaitingMyVoteCountQueryOptions(
      { nationId: null, settlementId },
      activeCharacter?.id ?? "",
    ),
    enabled: settlementId !== null && activeCharacter !== null,
  });
  const nationAwaitingMyVoteCount = nationAwaitingMyVoteQuery.data ?? 0;
  const settlementAwaitingMyVoteCount = settlementAwaitingMyVoteQuery.data ?? 0;

  if (!isAuthenticated) {
    return null;
  }

  // Prefix-aware so /superadmin/<sub-route>/anything highlights its sidebar
  // entry once /superadmin has sub-routes — each entry checks its own path.
  const adminItems: NavGroupItem[] = effectiveIsSuperAdmin
    ? [
        {
          key: "superadmin-users",
          label: "Users",
          isActive: isNavPathActive(location.pathname, "/superadmin/users"),
          link: (
            <Link to="/superadmin/users">
              <ShieldCheck aria-hidden="true" />
              <span>Users</span>
            </Link>
          ),
        },
        {
          key: "superadmin-transitions",
          label: "Stuck Transitions",
          isActive: isNavPathActive(
            location.pathname,
            "/superadmin/transitions",
          ),
          link: (
            <Link to="/superadmin/transitions">
              <AlertTriangle aria-hidden="true" />
              <span>Stuck Transitions</span>
            </Link>
          ),
        },
        {
          key: "superadmin-worlds",
          label: "Worlds",
          isActive: isNavPathActive(location.pathname, "/superadmin/worlds"),
          link: (
            <Link to="/superadmin/worlds">
              <Globe2 aria-hidden="true" />
              <span>Worlds</span>
            </Link>
          ),
        },
        {
          key: "template-library",
          label: "Template Library",
          isActive: isNavPathActive(location.pathname, "/superadmin/templates"),
          link: (
            <Link to="/superadmin/templates">
              <BookOpen aria-hidden="true" />
              <span>Template Library</span>
            </Link>
          ),
        },
        {
          key: "superadmin-email",
          label: "Email",
          isActive: isNavPathActive(location.pathname, "/superadmin/email"),
          link: (
            <Link to="/superadmin/email">
              <Mail aria-hidden="true" />
              <span>Email</span>
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
          {adminItems.length > 0 ? <SidebarSeparator /> : null}
          <NavGroup label="Superadmin" items={adminItems} />
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
      ? sectionFromPathname(location.pathname, settlementBasePath, {
          fallback: "overview",
          segments: SETTLEMENT_SECTION_SEGMENTS,
        })
      : null;

  // Mirrors the SETTLEMENT guard above, one level up: only read a NATION
  // section from the pathname while actually on that nation's route tree.
  const nationBasePath =
    nationId !== null ? `/worlds/${worldId}/nations/${nationId}` : null;
  const isOnNationPage =
    nationBasePath !== null &&
    (location.pathname === nationBasePath ||
      location.pathname.startsWith(`${nationBasePath}/`));
  const currentNationSection =
    isOnNationPage && nationBasePath !== null
      ? sectionFromPathname(location.pathname, nationBasePath, {
          fallback: "overview",
          nullSubtreePrefix: "settlements/",
          segments: NATION_SECTION_SEGMENTS,
        })
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
          <Zap aria-hidden="true" />
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
  // collapse to a single entry pointing at a settlement listing: the current
  // nation's Settlements page when a nation is scoped, otherwise the world
  // nations list where a nation (and then a settlement) can be picked
  // (docs/ui-redesign.md §3.2).
  const settlementItems: NavGroupItem[] =
    settlementId === null || nationId === null
      ? [
          nationId !== null
            ? {
                key: "settlement-choose",
                label: "Choose a settlement…",
                isActive: false,
                link: (
                  <Link
                    to="/worlds/$worldId/nations/$nationId/settlements"
                    params={{ nationId, worldId }}
                  >
                    <MapPin aria-hidden="true" />
                    <span>Choose a settlement…</span>
                  </Link>
                ),
              }
            : {
                key: "settlement-choose",
                label: "Choose a nation…",
                isActive: false,
                link: (
                  <Link to="/worlds/$worldId/nations" params={{ worldId }}>
                    <MapPin aria-hidden="true" />
                    <span>Choose a nation…</span>
                  </Link>
                ),
              },
        ]
      : buildSettlementSectionItems({
          currentSection,
          effectiveCanAdmin,
          governmentBadge: settlementAwaitingMyVoteCount,
          nationId,
          settlementId,
          worldId,
        });

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
      : buildNationSectionItems({
          currentSection: currentNationSection,
          effectiveCanAdmin,
          governmentBadge: nationAwaitingMyVoteCount,
          nationId,
          worldId,
        });

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
      key: "citizens",
      label: "Citizens",
      isActive: location.pathname === `/worlds/${worldId}/citizens`,
      link: (
        <Link to="/worlds/$worldId/citizens" params={{ worldId }}>
          <Users aria-hidden="true" />
          <span>Citizens</span>
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
      {activeCharacter !== null || canAdmin ? (
        <SidebarHeader>
          <CharacterCard canAdmin={canAdmin} worldId={worldId} />
        </SidebarHeader>
      ) : null}
      <SidebarContent>
        <NavGroup label="PLAY" items={playItems} />
        <SidebarSeparator />
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
        <SidebarSeparator />
        <NavGroup
          label="NATION"
          items={nationItems}
          labelSlot={
            <NationScopeSwitcher
              nationId={nationId}
              section={currentNationSection}
              worldId={worldId}
            />
          }
        />
        <SidebarSeparator />
        <NavGroup
          label="WORLD"
          items={worldItems}
          extraContent={
            effectiveCanAdmin ? (
              <ConfigurationNavItem
                isSuperAdmin={effectiveIsSuperAdmin}
                worldId={worldId}
              />
            ) : null
          }
        />
        {adminItems.length > 0 ? <SidebarSeparator /> : null}
        <NavGroup label="Superadmin" items={adminItems} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
