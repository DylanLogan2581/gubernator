import { Link } from "@tanstack/react-router";

import { SIGN_IN_DEFAULT_RETURN_PATH } from "@/features/auth";

import type { JSX } from "react";

/** Landing-page footer: sign-in link, per the unauth marketing page spec. */
export function HomeFooterSection(): JSX.Element {
  return (
    <footer className="flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row">
      <p>Gubernator — build nations, grow settlements, manage turns.</p>
      <Link
        to="/sign-in"
        search={{ returnTo: SIGN_IN_DEFAULT_RETURN_PATH }}
        className="font-medium text-foreground underline-offset-4 hover:underline"
      >
        Sign in to play
      </Link>
    </footer>
  );
}
