import { isCancelledError, QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  Link,
  Outlet,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { MapPinOff } from "lucide-react";
import { lazy, Suspense, useEffect, type JSX } from "react";

import { AppLayout } from "@/components/app/AppLayout";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { UserMenu } from "@/features/auth";
import { scheduleAuthStateQueryCacheSync } from "@/lib/authStateQueryCache";
import { Toaster } from "@/lib/notify";
import { type AppRouterContext } from "@/lib/queryClient";
import { subscribeToSupabaseAuthStateChanges } from "@/lib/supabaseAuthState";
import {
  shouldBlockAppForSupabaseConfig,
  supabaseConfig,
} from "@/lib/supabaseConfig";
import { useTheme } from "@/lib/theme";
import { ThemeProvider } from "@/lib/ThemeProvider";

const isDev =
  import.meta.env.DEV && import.meta.env.VITE_DISABLE_DEVTOOLS !== "true";

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
  const shouldBlockForConfig = shouldBlockAppForSupabaseConfig(supabaseConfig);

  useEffect(
    () =>
      subscribeToSupabaseAuthStateChanges({
        onAuthStateChange: (_event, session) => {
          scheduleAuthStateQueryCacheSync(queryClient, session);
        },
      }),
    [queryClient],
  );

  return (
    <ThemeProvider>
      <TooltipProvider>
        <QueryClientProvider client={queryClient}>
          <AppLayout headerAction={<UserMenu />}>
            {shouldBlockForConfig ? <SupabaseConfigErrorPage /> : <Outlet />}
          </AppLayout>
          <ThemedToaster />
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
      </TooltipProvider>
    </ThemeProvider>
  );
}

// Sonner follows the same selection as the rest of the app; "system" lets
// Sonner honor prefers-color-scheme, matching the CSS fallback (#1381).
function ThemedToaster(): JSX.Element {
  const { theme } = useTheme();
  return (
    <Toaster theme={theme} richColors closeButton position="bottom-right" />
  );
}

export const Route = createRootRouteWithContext<AppRouterContext>()({
  component: RootLayout,
  errorComponent: RootErrorBoundary,
  notFoundComponent: NotFoundPage,
});

function RootErrorBoundary({ error }: ErrorComponentProps): JSX.Element | null {
  const router = useRouter();

  useEffect(() => {
    if (isCancelledError(error)) {
      void router.invalidate();
      return;
    }
    console.error("Unhandled route error", error);
  }, [error, router]);

  if (isCancelledError(error)) {
    return null;
  }

  return (
    <ErrorState
      title="Something went wrong"
      description="An unexpected error occurred. Try again or return to sign in."
      action={
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              void router.invalidate();
            }}
          >
            Try again
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/">Go to sign in</Link>
          </Button>
        </div>
      }
    />
  );
}

function NotFoundPage(): JSX.Element {
  return (
    <EmptyState
      icon={MapPinOff}
      title="Page not found"
      description="The page you're looking for doesn't exist or may have moved."
      action={
        <Button asChild variant="outline" size="sm">
          <Link to="/">Go to sign in</Link>
        </Button>
      }
    />
  );
}

function SupabaseConfigErrorPage(): JSX.Element {
  return (
    <ErrorState
      title="Application configuration required"
      description="Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before running this production build."
    />
  );
}
