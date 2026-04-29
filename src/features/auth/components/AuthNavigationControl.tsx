import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Globe2, LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";

import { currentSessionQueryOptions } from "../queries/authQueries";
import { SIGN_IN_DEFAULT_RETURN_PATH } from "../schemas/signInSchemas";

import { SignOutControl } from "./SignOutControl";

import type { JSX } from "react";

export function AuthNavigationControl(): JSX.Element | null {
  const currentSessionQuery = useQuery(currentSessionQueryOptions());
  const currentSession = currentSessionQuery.data ?? null;

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

  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="ghost" size="sm">
        <Link to="/worlds">
          <Globe2 aria-hidden="true" />
          Worlds
        </Link>
      </Button>
      <SignOutControl />
    </div>
  );
}
