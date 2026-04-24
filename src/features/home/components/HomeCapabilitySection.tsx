import { useQuery } from "@tanstack/react-query";
import { Check, Database, Router } from "lucide-react";

import { Button } from "@/components/ui/button";

import { sessionQueryOptions } from "../queries/homeQueries";

import type { JSX } from "react";

export function HomeCapabilitySection(): JSX.Element {
  const sessionQuery = useQuery(sessionQueryOptions);

  return (
    <section className="grid gap-4 md:grid-cols-3">
      <article className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Router className="size-4" />
          <h2 className="font-medium">TanStack Router</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          The route file stays thin and preloads feature-owned query data before
          rendering the page module.
        </p>
      </article>

      <article className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Database className="size-4" />
          <h2 className="font-medium">Query + Supabase</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          {sessionQuery.isPending
            ? "Loading..."
            : sessionQuery.isError
              ? "Failed to load session."
              : sessionQuery.data}
        </p>
      </article>

      <article className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Check className="size-4" />
          <h2 className="font-medium">UI primitives</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button>
            <Check />
            Default button
          </Button>
          <Button asChild variant="outline">
            <a href="https://ui.shadcn.com" target="_blank" rel="noreferrer">
              View shadcn/ui
            </a>
          </Button>
        </div>
      </article>
    </section>
  );
}
