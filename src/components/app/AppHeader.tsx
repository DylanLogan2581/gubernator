import { Link, useLocation, useParams } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { type JSX, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useEffectiveCanAdmin } from "@/features/permissions";

import { HeaderEndTurnControl } from "./HeaderEndTurnControl";
import { HeaderReadinessChip } from "./HeaderReadinessChip";
import { NotificationsPopover } from "./NotificationsPopover";
import { useAppShellWorldContext } from "./sidebar/UseAppShellWorldContext";
import { SuperadminBreadcrumb } from "./SuperadminBreadcrumb";
import { WorldBreadcrumb } from "./WorldBreadcrumb";

type AppHeaderProps = {
  readonly action?: ReactNode;
  readonly onOpenCommandPalette?: () => void;
};

type CommandPaletteTriggerProps = {
  readonly onOpen?: () => void;
};

type AuthenticatedHeaderControlsProps = {
  readonly canAdmin: boolean;
  readonly nationId: string | null;
  readonly onOpenCommandPalette?: () => void;
  readonly settlementId: string | null;
  readonly turnLabel: string | null;
  readonly worldAccess: ReturnType<
    typeof useAppShellWorldContext
  >["worldAccess"];
  readonly worldId: string | null;
};

// Slim header inside SidebarInset: trigger + breadcrumb on the left; turn
// chip, End Turn (effective admins only) / readiness chip (settlement
// managers), the command-palette trigger, notifications, and the user menu
// (rightmost, via `action`) on the right (docs/ui-redesign.md §3.3). Brand/
// logo lives in the sidebar only — except for signed-out visitors, who have
// no sidebar, so the header shows a minimal logo + `action` (sign-in CTA)
// state instead (#1154).
export function AppHeader({
  action,
  onOpenCommandPalette,
}: AppHeaderProps): JSX.Element {
  const routeParams = useParams({ strict: false });
  const location = useLocation();
  const nationId = routeParams.nationId ?? null;
  const settlementId = routeParams.settlementId ?? null;
  const {
    canAdmin,
    isAuthenticated,
    turnLabel,
    worldAccess,
    worldId,
    worldName,
  } = useAppShellWorldContext();
  const effectiveCanAdmin = useEffectiveCanAdmin(canAdmin);

  return (
    <header
      data-slot="app-header"
      className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4"
    >
      {isAuthenticated ? <SidebarTrigger /> : null}
      <div className="flex min-w-0 flex-1 items-center">
        {!isAuthenticated ? (
          <Link to="/" className="flex items-center gap-2 font-semibold">
            <img src="/logo.png" alt="" className="size-6" />
            <span>Gubernator</span>
          </Link>
        ) : worldId !== null && worldName !== null ? (
          <WorldBreadcrumb worldId={worldId} worldName={worldName} />
        ) : location.pathname.startsWith("/superadmin") ? (
          <SuperadminBreadcrumb />
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isAuthenticated ? (
          <AuthenticatedHeaderControls
            canAdmin={effectiveCanAdmin}
            nationId={nationId}
            onOpenCommandPalette={onOpenCommandPalette}
            settlementId={settlementId}
            turnLabel={turnLabel}
            worldAccess={worldAccess}
            worldId={worldId}
          />
        ) : null}
        {location.pathname === "/sign-in" ? null : action}
      </div>
    </header>
  );
}

// Turn chip, End Turn / readiness chip, command-palette trigger, and
// notifications bell — everything on the right that only makes sense for a
// signed-in viewer (#1154).
function AuthenticatedHeaderControls({
  canAdmin,
  nationId,
  onOpenCommandPalette,
  settlementId,
  turnLabel,
  worldAccess,
  worldId,
}: AuthenticatedHeaderControlsProps): JSX.Element {
  return (
    <>
      {turnLabel !== null ? (
        <span className="hidden shrink-0 text-sm text-muted-foreground sm:inline">
          {turnLabel}
        </span>
      ) : null}
      {worldId !== null && worldAccess !== null ? (
        <HeaderEndTurnControl
          canAdmin={canAdmin}
          currentDateLabel={worldAccess.header.inWorldDateLabel}
          currentTurnNumber={worldAccess.header.currentTurnNumber}
          isArchived={worldAccess.header.isArchived}
          nextDateLabel={worldAccess.header.nextInWorldDateLabel}
          nextTurnNumber={worldAccess.header.nextTurnNumber}
          worldId={worldId}
        />
      ) : null}
      {worldId !== null && nationId !== null && settlementId !== null ? (
        <HeaderReadinessChip
          canAdmin={canAdmin}
          nationId={nationId}
          settlementId={settlementId}
          worldId={worldId}
        />
      ) : null}
      <CommandPaletteTrigger onOpen={onOpenCommandPalette} />
      <NotificationsPopover />
    </>
  );
}

// Opens the CommandPalette mounted by AppLayout (single shared instance —
// the global ⌘K shortcut and this button both target it).
function CommandPaletteTrigger({
  onOpen,
}: CommandPaletteTriggerProps): JSX.Element {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2 text-muted-foreground"
      onClick={onOpen}
    >
      <Search className="size-4" aria-hidden="true" />
      <span className="hidden sm:inline">Search…</span>
      <kbd className="pointer-events-none ml-2 hidden h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
        <span aria-hidden="true">⌘</span>K
      </kbd>
    </Button>
  );
}
