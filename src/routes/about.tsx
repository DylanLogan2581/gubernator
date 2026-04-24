import { createFileRoute } from "@tanstack/react-router";
import { Blocks, LayoutPanelTop, ShieldCheck } from "lucide-react";

import type { JSX } from "react";

function AboutPage(): JSX.Element {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 py-6">
      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">About this starter</p>
        <h1 className="mt-2 text-3xl font-semibold">
          A clean foundation for web apps
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          This template is set up to give new projects a polished starting point
          with routing, data fetching, UI primitives, and Supabase-ready
          structure.
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <LayoutPanelTop className="size-4" />
            <h2 className="font-medium">Shared layout</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Header, footer, and page framing stay consistent so individual
            routes can stay focused.
          </p>
        </article>

        <article className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Blocks className="size-4" />
            <h2 className="font-medium">Composable pieces</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            The structure encourages reusable components, feature folders, and
            small modules.
          </p>
        </article>

        <article className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="size-4" />
            <h2 className="font-medium">Production-minded</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            The repo is organized around testing, security review, migrations,
            and RLS-first data access.
          </p>
        </article>
      </section>

      <section className="rounded-2xl border bg-card p-6 shadow-sm">
        <h2 className="font-medium">
          Keep pages small, grow features intentionally
        </h2>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          As the app grows, route files should stay close to page composition
          while reusable UI, schemas, queries, and feature logic move into their
          own well-named modules. That keeps the project approachable for both
          people and language models working in the codebase.
        </p>
      </section>
    </div>
  );
}

export const Route = createFileRoute("/about")({
  component: AboutPage,
});
