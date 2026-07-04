import { type JSX, type ReactNode } from "react";

import { SidebarTrigger } from "@/components/ui/sidebar";

import { NotificationsPopover } from "./NotificationsPopover";

type AppHeaderProps = {
  readonly action?: ReactNode;
};

// Slim header inside SidebarInset: trigger + brand + action slot +
// notifications. The world/nation/settlement breadcrumb now renders inline
// in the world page content (see WorldEntryGate) rather than in this
// persistent header, keeping this component free of route-param data
// fetching. The brand label stays here (rather than only in the sidebar)
// since the sidebar itself renders nothing for signed-out visitors.
export function AppHeader({ action }: AppHeaderProps): JSX.Element {
  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
      <SidebarTrigger />
      <span className="text-sm font-medium">Gubernator</span>
      <div className="flex-1" />
      <div className="flex items-center gap-2">
        {action}
        <NotificationsPopover />
      </div>
    </header>
  );
}
