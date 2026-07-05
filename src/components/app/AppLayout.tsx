import { useState, type JSX, type ReactNode } from "react";

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";
import { CommandPalette } from "./CommandPalette";
import { AppShellProviders } from "./sidebar/AppShellProviders";
import { useRecentPageTracker } from "./UseRecentPageTracker";

type AppLayoutProps = {
  readonly headerAction?: ReactNode;
  children: ReactNode;
};

export function AppLayout({
  children,
  headerAction,
}: AppLayoutProps): JSX.Element {
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  useRecentPageTracker();

  return (
    <SidebarProvider>
      <AppShellProviders>
        <AppSidebar />
        <SidebarInset>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
          >
            Skip to main content
          </a>
          <AppHeader
            action={headerAction}
            onOpenCommandPalette={() => {
              setIsCommandPaletteOpen(true);
            }}
          />
          <main id="main-content" className="flex-1 p-4 lg:p-6">
            {children}
          </main>
          <CommandPalette
            onOpenChange={setIsCommandPaletteOpen}
            open={isCommandPaletteOpen}
          />
        </SidebarInset>
      </AppShellProviders>
    </SidebarProvider>
  );
}
