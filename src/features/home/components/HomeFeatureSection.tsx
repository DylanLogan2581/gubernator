import { Building2, Flag, ScrollText, Users } from "lucide-react";

import { IconChip } from "@/components/shared/IconChip";
import type { CategoricalSlot } from "@/lib/categoricalPalette";

import type { LucideIcon } from "lucide-react";
import type { JSX } from "react";

type FeatureCard = {
  readonly icon: LucideIcon;
  readonly tone: CategoricalSlot;
  readonly title: string;
  readonly description: string;
};

const FEATURE_CARDS: readonly FeatureCard[] = [
  {
    icon: Building2,
    tone: 2,
    title: "Settlements & economy",
    description:
      "Buildings, stockpiles, construction, and trade routes drive every settlement's economy from one turn to the next.",
  },
  {
    icon: Users,
    tone: 1,
    title: "Citizens & genealogy",
    description:
      "Citizens live, work, partner, and age across generations — family trees emerge from turn after turn of simulation.",
  },
  {
    icon: Flag,
    tone: 7,
    title: "Nations & roles",
    description:
      "Nations govern their settlements through a role ladder, from world admin down to nation manager and settlement manager.",
  },
  {
    icon: ScrollText,
    tone: 8,
    title: "Events & reports",
    description:
      "Active events and turn-by-turn reports surface what happened across the world, and why it matters.",
  },
] as const;

/**
 * Shipped-feature grid replacing the old "planned" capability cards — every
 * card describes something the game already does, not a roadmap promise.
 */
export function HomeFeatureSection(): JSX.Element {
  return (
    <section
      aria-label="Feature areas"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {FEATURE_CARDS.map(({ icon, tone, title, description }) => (
        <article
          key={title}
          className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
        >
          <IconChip icon={icon} tone={tone} />
          <h2 className="font-medium">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </article>
      ))}
    </section>
  );
}
