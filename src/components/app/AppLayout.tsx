import { type JSX, type ReactNode } from "react";

import { AppFooter } from "./AppFooter";
import { AppHeader } from "./AppHeader";
import { WorldContextBar } from "./WorldContextBar";

type AppLayoutProps = {
  children: ReactNode;
};

export function AppLayout({ children }: AppLayoutProps): JSX.Element {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-linear-to-b from-muted/60 via-background to-transparent" />
      <div className="pointer-events-none absolute left-1/2 -top-32 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4">
        <AppHeader />
        <WorldContextBar />
        <main id="main-content" className="flex-1 py-4">
          {children}
        </main>
        <AppFooter />
      </div>
    </div>
  );
}
