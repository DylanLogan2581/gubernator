import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeftRight,
  Banknote,
  Bell,
  BookOpen,
  Briefcase,
  Building2,
  Clock,
  Coins,
  FileText,
  Gem,
  Globe2,
  HardHat,
  Handshake,
  Landmark,
  LayoutDashboard,
  Mail,
  MapPin,
  Package,
  PawPrint,
  ScrollText,
  Settings,
  ShieldCheck,
  Swords,
  TrendingUp,
  UserCircle2,
  Users,
  Zap,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
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
import { SettlementScopeSwitcher } from "./sidebar/SettlementScopeSwitcher";
import { useAppShellWorldContext } from "./sidebar/UseAppShellWorldContext";
import { WorldHeaderCard } from "./sidebar/WorldHeaderCard";
import { useWorldScope } from "./sidebar/WorldScopeContext";

import type { NationSection } from "./sidebar/NationScopeSwitcher";
import type { SettlementSection } from "./sidebar/SettlementScopeSwitcher";
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
      ? sectionFromPathname(location.pathname, settlementBasePath)
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
      ? nationSectionFromPathname(location.pathname, nationBasePath)
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
          settlementSectionItem("assignments", {
            isActive: currentSection === "assignments",
            label: "Job Assignments",
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
          settlementSectionItem("government", {
            badge: settlementAwaitingMyVoteCount,
            isActive: currentSection === "government",
            label: "Government",
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
          nationSectionItem("overview", {
            isActive: currentNationSection === "overview",
            label: "Overview",
            nationId,
            worldId,
          }),
          nationSectionItem("settlements", {
            isActive: currentNationSection === "settlements",
            label: "Settlements",
            nationId,
            worldId,
          }),
          nationSectionItem("relationships", {
            isActive: currentNationSection === "relationships",
            label: "Relationships",
            nationId,
            worldId,
          }),
          nationSectionItem("government", {
            badge: nationAwaitingMyVoteCount,
            isActive: currentNationSection === "government",
            label: "Government",
            nationId,
            worldId,
          }),
          nationSectionItem("charter", {
            isActive: currentNationSection === "charter",
            label: "Charter",
            nationId,
            worldId,
          }),
          nationSectionItem("military", {
            isActive: currentNationSection === "military",
            label: "Military",
            nationId,
            worldId,
          }),
          nationSectionItem("treasury", {
            isActive: currentNationSection === "treasury",
            label: "Treasury",
            nationId,
            worldId,
          }),
          nationSectionItem("bank", {
            isActive: currentNationSection === "bank",
            label: "Bank",
            nationId,
            worldId,
          }),
          nationSectionItem("reports", {
            isActive: currentNationSection === "reports",
            label: "Reports",
            nationId,
            worldId,
          }),
          ...(effectiveCanAdmin
            ? [
                nationSectionItem("settings", {
                  isActive: currentNationSection === "settings",
                  label: "Settings",
                  nationId,
                  worldId,
                }),
              ]
            : []),
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
      <CharacterCard canAdmin={canAdmin} worldId={worldId} />
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

const SETTLEMENT_SECTION_SEGMENTS: ReadonlySet<string> = new Set<
  Exclude<SettlementSection, "overview">
>([
  "assignments",
  "buildings",
  "citizens",
  "construction",
  "deposits",
  "forecast",
  "government",
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
    badge,
    isActive,
    label,
    nationId,
    settlementId,
    worldId,
  }: {
    readonly badge?: number;
    readonly isActive: boolean;
    readonly label: string;
    readonly nationId: string;
    readonly settlementId: string;
    readonly worldId: string;
  },
): NavGroupItem {
  const icons: Record<SettlementSection, JSX.Element> = {
    assignments: <Briefcase aria-hidden="true" />,
    buildings: <Building2 aria-hidden="true" />,
    citizens: <Users aria-hidden="true" />,
    construction: <HardHat aria-hidden="true" />,
    deposits: <Gem aria-hidden="true" />,
    forecast: <TrendingUp aria-hidden="true" />,
    government: <ShieldCheck aria-hidden="true" />,
    history: <Clock aria-hidden="true" />,
    overview: <LayoutDashboard aria-hidden="true" />,
    populations: <PawPrint aria-hidden="true" />,
    reports: <FileText aria-hidden="true" />,
    settings: <Settings aria-hidden="true" />,
    stockpiles: <Package aria-hidden="true" />,
    trade: <ArrowLeftRight aria-hidden="true" />,
  };

  switch (section) {
    case "assignments":
      return {
        key: "settlement-assignments",
        label,
        isActive,
        link: (
          <Link
            to="/worlds/$worldId/nations/$nationId/settlements/$settlementId/assignments"
            params={{ nationId, settlementId, worldId }}
          >
            {icons[section]}
            <span>{label}</span>
          </Link>
        ),
      };
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
    case "government":
      return {
        key: "settlement-government",
        label,
        badge,
        isActive,
        link: (
          <Link
            to="/worlds/$worldId/nations/$nationId/settlements/$settlementId/government"
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

const NATION_SECTION_SEGMENTS: ReadonlySet<string> = new Set<
  Exclude<NationSection, "overview">
>([
  "bank",
  "charter",
  "government",
  "military",
  "relationships",
  "reports",
  "settings",
  "settlements",
  "treasury",
]);

function isNationSectionSegment(
  value: string,
): value is Exclude<NationSection, "overview"> {
  return NATION_SECTION_SEGMENTS.has(value);
}

// Derives the active NATION sidebar item from the pathname suffix past the
// nation's base route — mirrors sectionFromPathname (SETTLEMENT), one level
// up. Unlike SETTLEMENT (the deepest scope), NATION has a real subtree below
// it that isn't one of its own sections — the settlement-detail routes
// (`/settlements/$settlementId/...`) — so a `settlements/<id>` suffix must
// return null (no NATION item active) rather than falling back to
// "overview"; only a genuinely unrecognized suffix falls back that way.
function nationSectionFromPathname(
  pathname: string,
  nationBasePath: string,
): NationSection | null {
  const suffix = pathname.slice(nationBasePath.length);
  const segment = suffix.startsWith("/") ? suffix.slice(1) : suffix;
  if (segment.startsWith("settlements/")) {
    return null;
  }
  return segment !== "" && isNationSectionSegment(segment)
    ? segment
    : "overview";
}

function nationSectionItem(
  section: NationSection,
  {
    badge,
    isActive,
    label,
    nationId,
    worldId,
  }: {
    readonly badge?: number;
    readonly isActive: boolean;
    readonly label: string;
    readonly nationId: string;
    readonly worldId: string;
  },
): NavGroupItem {
  const icons: Record<NationSection, JSX.Element> = {
    bank: <Banknote aria-hidden="true" />,
    charter: <ScrollText aria-hidden="true" />,
    government: <ShieldCheck aria-hidden="true" />,
    military: <Swords aria-hidden="true" />,
    overview: <LayoutDashboard aria-hidden="true" />,
    relationships: <Handshake aria-hidden="true" />,
    reports: <FileText aria-hidden="true" />,
    settings: <Settings aria-hidden="true" />,
    settlements: <Building2 aria-hidden="true" />,
    treasury: <Coins aria-hidden="true" />,
  };

  switch (section) {
    case "overview":
      return {
        key: "nation-overview",
        label,
        isActive,
        link: (
          <Link
            to="/worlds/$worldId/nations/$nationId"
            params={{ nationId, worldId }}
          >
            {icons[section]}
            <span>{label}</span>
          </Link>
        ),
      };
    case "settlements":
      return {
        key: "nation-settlements",
        label,
        isActive,
        link: (
          <Link
            to="/worlds/$worldId/nations/$nationId/settlements"
            params={{ nationId, worldId }}
          >
            {icons[section]}
            <span>{label}</span>
          </Link>
        ),
      };
    case "relationships":
      return {
        key: "nation-relationships",
        label,
        isActive,
        link: (
          <Link
            to="/worlds/$worldId/nations/$nationId/relationships"
            params={{ nationId, worldId }}
          >
            {icons[section]}
            <span>{label}</span>
          </Link>
        ),
      };
    case "government":
      return {
        key: "nation-government",
        label,
        badge,
        isActive,
        link: (
          <Link
            to="/worlds/$worldId/nations/$nationId/government"
            params={{ nationId, worldId }}
          >
            {icons[section]}
            <span>{label}</span>
          </Link>
        ),
      };
    case "military":
      return {
        key: "nation-military",
        label,
        isActive,
        link: (
          <Link
            to="/worlds/$worldId/nations/$nationId/military"
            params={{ nationId, worldId }}
          >
            {icons[section]}
            <span>{label}</span>
          </Link>
        ),
      };
    case "reports":
      return {
        key: "nation-reports",
        label,
        isActive,
        link: (
          <Link
            to="/worlds/$worldId/nations/$nationId/reports"
            params={{ nationId, worldId }}
          >
            {icons[section]}
            <span>{label}</span>
          </Link>
        ),
      };
    case "settings":
      return {
        key: "nation-settings",
        label,
        isActive,
        link: (
          <Link
            to="/worlds/$worldId/nations/$nationId/settings"
            params={{ nationId, worldId }}
          >
            {icons[section]}
            <span>{label}</span>
          </Link>
        ),
      };
    case "treasury":
      return {
        key: "nation-treasury",
        label,
        isActive,
        link: (
          <Link
            to="/worlds/$worldId/nations/$nationId/treasury"
            params={{ nationId, worldId }}
          >
            {icons[section]}
            <span>{label}</span>
          </Link>
        ),
      };
    case "bank":
      return {
        key: "nation-bank",
        label,
        isActive,
        link: (
          <Link
            to="/worlds/$worldId/nations/$nationId/bank"
            params={{ nationId, worldId }}
          >
            {icons[section]}
            <span>{label}</span>
          </Link>
        ),
      };
    case "charter":
      return {
        key: "nation-charter",
        label,
        isActive,
        link: (
          <Link
            to="/worlds/$worldId/nations/$nationId/charter"
            params={{ nationId, worldId }}
          >
            {icons[section]}
            <span>{label}</span>
          </Link>
        ),
      };
  }
}
