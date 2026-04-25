import { HomeCapabilitySection } from "./HomeCapabilitySection";

import type { JSX } from "react";

export function HomePage(): JSX.Element {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 py-6">
      <section className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border bg-card p-6 shadow-sm">
        <h1 className="text-3xl font-semibold">Gubernator</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          A turn-based world simulation and management application. Build
          nations, manage settlements, oversee citizens, and track resources
          across a structured calendar of turns.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Feature areas are listed below and will become functional in upcoming
          epics.
        </p>
      </section>

      <HomeCapabilitySection />
    </div>
  );
}
