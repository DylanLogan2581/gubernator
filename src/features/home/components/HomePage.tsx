import { HomeCapabilitySection } from "./HomeCapabilitySection";
import { HomeFormSection } from "./HomeFormSection";

import type { JSX } from "react";

export function HomePage(): JSX.Element {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 py-6">
      <section className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border bg-card p-6 shadow-sm">
        <p className="text-sm text-muted-foreground">
          web application template
        </p>
        <h1 className="mt-2 text-3xl font-semibold">
          Small demo, strong defaults
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          The starter intentionally keeps the route thin and moves page logic
          into the feature so the example matches the structure the template
          expects in real apps.
        </p>
      </section>

      <HomeCapabilitySection />
      <HomeFormSection />
    </div>
  );
}
