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
import { Toaster } from "sonner";

import { AppLayout } from "@/components/app/AppLayout";
import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthNavigationControl } from "@/features/auth";
import { scheduleAuthStateQueryCacheSync } from "@/lib/authStateQueryCache";
import { type AppRouterContext } from "@/lib/queryClient";
import { subscribeToSupabaseAuthStateChanges } from "@/lib/supabaseAuthState";
import {
  shouldBlockAppForSupabaseConfig,
  supabaseConfig,
} from "@/lib/supabaseConfig";

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
    <TooltipProvider>
      <QueryClientProvider client={queryClient}>
        <AppLayout headerAction={<AuthNavigationControl />}>
          {shouldBlockForConfig ? <SupabaseConfigErrorPage /> : <Outlet />}
        </AppLayout>
        <Toaster
          theme="system"
          richColors
          closeButton
          position="bottom-right"
        />
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
    }
  }, [error, router]);

  if (isCancelledError(error)) {
    return null;
  }

  const message = error instanceof Error ? error.message : String(error);

  return (
    <div className="mx-auto max-w-4xl py-6">
      <ErrorState title="Something went wrong" description={message} />
    </div>
  );
}

function NotFoundPage(): JSX.Element {
  return (
    <div className="mx-auto max-w-4xl py-6">
      <EmptyState
        icon={MapPinOff}
        title="Page not found"
        description="The page you're looking for doesn't exist or may have moved."
        action={
          <Button asChild variant="outline" size="sm">
            <Link to="/">Go to home</Link>
          </Button>
        }
      />
    </div>
  );
}

function SupabaseConfigErrorPage(): JSX.Element {
  return (
    <div className="mx-auto max-w-4xl py-6">
      <ErrorState
        title="Application configuration required"
        description="Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY before running this production build."
      />
    </div>
  );
}
