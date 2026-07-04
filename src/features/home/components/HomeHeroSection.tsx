import { Link } from "@tanstack/react-router";
import { LogIn } from "lucide-react";

import { Button } from "@/components/ui/button";
import { SIGN_IN_DEFAULT_RETURN_PATH } from "@/features/auth";

import type { JSX } from "react";

/**
 * Unauth landing hero: product name, pitch, sign-in CTA, and the crown
 * emblem (`public/logo.png`) as the illustrated mark (docs/ui-redesign.md
 * §5). Fully static — no Supabase queries.
 */
export function HomeHeroSection(): JSX.Element {
  return (
    <section className="grid items-center gap-6 rounded-xl bg-card p-6 ring-1 ring-foreground/10 md:grid-cols-[1fr_auto] md:p-10">
      <div className="flex flex-col items-start gap-4">
        <h1 className="text-4xl font-semibold tracking-tight text-balance">
          Gubernator
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground text-balance">
          A turn-based world simulation game: found nations, grow settlements,
          and steer generations of citizens through the outcome of every turn.
        </p>
        <Button asChild size="lg">
          <Link
            to="/sign-in"
            search={{ returnTo: SIGN_IN_DEFAULT_RETURN_PATH }}
          >
            <LogIn aria-hidden="true" />
            Sign in to play
          </Link>
        </Button>
      </div>
      <div className="flex size-32 shrink-0 items-center justify-center justify-self-center rounded-full bg-primary/10 p-6 md:size-40">
        <img src="/logo.png" alt="" className="size-full object-contain" />
      </div>
    </section>
  );
}
