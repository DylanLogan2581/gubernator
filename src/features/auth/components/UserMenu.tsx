import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { LoaderCircle, LogIn, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEffectiveCanAdmin } from "@/features/permissions";
import { syncAuthStateQueryCache } from "@/lib/authStateQueryCache";
import { notifyMutationSuccess } from "@/lib/notify";

import { signOutMutationOptions } from "../mutations/authMutations";
import {
  currentAppUserQueryOptions,
  currentSessionQueryOptions,
} from "../queries/authQueries";
import { SIGN_IN_DEFAULT_RETURN_PATH } from "../schemas/signInSchemas";

import type { JSX } from "react";

// Far-right header control (docs/ui-redesign.md §3.3): avatar trigger opens
// a menu with the signed-in user's email, a superadmin link (suppressed
// while an active player character is selected, matching the sidebar's
// admin-nav gating), and sign out. Admin/Worlds link strip removed — the
// sidebar already covers both destinations.
export function UserMenu(): JSX.Element | null {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentSessionQuery = useQuery(currentSessionQueryOptions());
  const currentAppUserQuery = useQuery(currentAppUserQueryOptions());
  const signOutMutation = useMutation(signOutMutationOptions());
  const currentSession = currentSessionQuery.data ?? null;
  const isSuperAdmin = currentAppUserQuery.data?.is_super_admin === true;
  const effectiveIsSuperAdmin = useEffectiveCanAdmin(isSuperAdmin);
  const isBusy = signOutMutation.isPending;

  if (currentSessionQuery.isPending) {
    return null;
  }

  if (currentSession === null) {
    return (
      <Button asChild variant="outline" size="sm">
        <Link to="/sign-in" search={{ returnTo: SIGN_IN_DEFAULT_RETURN_PATH }}>
          <LogIn aria-hidden="true" />
          Sign in
        </Link>
      </Button>
    );
  }

  const email =
    currentAppUserQuery.data?.email ?? currentSession.user.email ?? "Account";

  function handleSignOut(): void {
    signOutMutation.mutate(undefined, {
      onError: () => {
        toast.error("Sign-out failed. Try again.");
      },
      onSuccess: () => {
        syncAuthStateQueryCache(queryClient, null);
        notifyMutationSuccess("Signed out.");
        void navigate({ to: "/" });
      },
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="User menu"
        >
          <Avatar className="size-8">
            <AvatarFallback>{email.charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="truncate font-normal text-muted-foreground">
          {email}
        </DropdownMenuLabel>
        {effectiveIsSuperAdmin ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/superadmin">
                <ShieldCheck aria-hidden="true" />
                Superadmin
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={isBusy} onClick={handleSignOut}>
          {isBusy ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <LogOut aria-hidden="true" />
          )}
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
