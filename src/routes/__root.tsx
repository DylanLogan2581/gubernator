import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  Outlet,
  Link,
} from "@tanstack/react-router";
import { Layers3, Sparkles } from "lucide-react";
import { lazy, Suspense, type JSX } from "react";

import { Button } from "@/components/ui/button";
import { type AppRouterContext } from "@/lib/queryClient";

const isDev = import.meta.env.DEV;

const TanStackRouterDevtools = isDev
  ? lazy(() =>
      import("@tanstack/react-router-devtools").then((mod) => ({
        default: mod.TanStackRouterDevtools,
      })),
    )
  : null;

const ReactQueryDevtools = isDev
  ? lazy(() =>
      import("@tanstack/react-query-devtools").then((mod) => ({
        default: mod.ReactQueryDevtools,
      })),
    )
  : null;

function RootLayout(): JSX.Element {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
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
          <header className="sticky top-0 z-10 py-4">
            <div className="rounded-2xl border border-border/70 bg-background/85 px-4 py-3 shadow-sm backdrop-blur">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                    <Layers3 className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      web application template
                    </p>
                    <p className="text-xs text-muted-foreground">
                      React, TanStack, shadcn/ui, and Supabase starter
                    </p>
                  </div>
                </div>

                <nav
                  aria-label="Primary navigation"
                  className="flex flex-wrap items-center gap-2"
                >
                  <Button asChild variant="ghost" size="sm">
                    <Link
                      to="/"
                      activeProps={{ className: "bg-muted text-foreground" }}
                      activeOptions={{ exact: true }}
                    >
                      Home
                    </Link>
                  </Button>
                  <Button asChild variant="ghost" size="sm">
                    <Link
                      to="/about"
                      activeProps={{ className: "bg-muted text-foreground" }}
                    >
                      About
                    </Link>
                  </Button>
                </nav>
              </div>
            </div>
          </header>

          <main id="main-content" className="flex-1 py-4">
            <Outlet />
          </main>

          <footer className="py-6">
            <div className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-card/70 px-4 py-4 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">
                  Built for fast starts and clean handoffs.
                </p>
                <p className="text-muted-foreground">
                  Use the template as a launch point for product work,
                  prototypes, and internal tools.
                </p>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Sparkles className="size-4" />
                <span>
                  Consistent routes, shared UI, and a clear structure.
                </span>
              </div>
            </div>
          </footer>
        </div>
      </div>
      {TanStackRouterDevtools !== null ? (
        <Suspense fallback={null}>
          <TanStackRouterDevtools />
        </Suspense>
      ) : null}
      {ReactQueryDevtools !== null ? (
        <Suspense fallback={null}>
          <ReactQueryDevtools />
        </Suspense>
      ) : null}
    </QueryClientProvider>
  );
}

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: RootLayout,
});
