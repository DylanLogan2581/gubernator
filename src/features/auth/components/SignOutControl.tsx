import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LoaderCircle, LogOut } from "lucide-react";
import { type JSX } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { syncAuthStateQueryCache } from "@/lib/authStateQueryCache";
import { notifyMutationSuccess } from "@/lib/notify";

import { signOutMutationOptions } from "../mutations/authMutations";
import { currentSessionQueryOptions } from "../queries/authQueries";

export function SignOutControl(): JSX.Element | null {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentSessionQuery = useQuery(currentSessionQueryOptions());
  const signOutMutation = useMutation(signOutMutationOptions());
  const currentSession = currentSessionQuery.data ?? null;
  const isAuthenticated = currentSession !== null;
  const isBusy = signOutMutation.isPending;

  if (currentSessionQuery.isPending || !isAuthenticated) {
    return null;
  }

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
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isBusy}
        onClick={handleSignOut}
      >
        {isBusy ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : (
          <LogOut aria-hidden="true" />
        )}
        Sign out
      </Button>
    </div>
  );
}
