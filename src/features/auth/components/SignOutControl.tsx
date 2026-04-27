import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { LoaderCircle, LogOut } from "lucide-react";
import { useState, type JSX } from "react";

import { Button } from "@/components/ui/button";

import { signOutMutationOptions } from "../mutations/authMutations";
import { currentSessionQueryOptions } from "../queries/authQueries";

export function SignOutControl(): JSX.Element | null {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const currentSessionQuery = useQuery(currentSessionQueryOptions());
  const signOutMutation = useMutation(signOutMutationOptions());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const currentSession = currentSessionQuery.data ?? null;
  const isAuthenticated = currentSession !== null;
  const isBusy = signOutMutation.isPending;

  if (currentSessionQuery.isPending || !isAuthenticated) {
    return null;
  }

  function handleSignOut(): void {
    setErrorMessage(null);
    signOutMutation.mutate(undefined, {
      onError: () => {
        setErrorMessage("Sign-out failed. Try again.");
      },
      onSuccess: () => {
        queryClient.clear();
        void navigate({ to: "/" });
      },
    });
  }

  return (
    <div className="flex items-center gap-2">
      {errorMessage === null ? null : (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      )}
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
