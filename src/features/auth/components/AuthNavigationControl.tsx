import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Globe2, LogIn, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";

import {
  currentAppUserQueryOptions,
  currentSessionQueryOptions,
} from "../queries/authQueries";
import { SIGN_IN_DEFAULT_RETURN_PATH } from "../schemas/signInSchemas";

import { SignOutControl } from "./SignOutControl";

import type { JSX } from "react";

export function AuthNavigationControl(): JSX.Element | null {
  const currentSessionQuery = useQuery(currentSessionQueryOptions());
  const currentAppUserQuery = useQuery(currentAppUserQueryOptions());
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

  const isSuperAdmin = currentAppUserQuery.data?.is_super_admin === true;

  return (
    <div className="flex items-center gap-2">
      {isSuperAdmin && (
        <Button asChild variant="ghost" size="sm">
          <Link to="/superadmin">
            <Settings aria-hidden="true" />
            Admin
          </Link>
        </Button>
      )}
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
