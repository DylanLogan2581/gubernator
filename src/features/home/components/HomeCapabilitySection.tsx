import {
  Building2,
  Calendar,
  Flag,
  Globe2,
  Package,
  Users,
} from "lucide-react";

import type { JSX } from "react";

const CAPABILITY_CARDS = [
  {
    icon: Globe2,
    title: "Worlds",
    description:
      "Create and manage simulation worlds. Each world is the top-level container for nations, turns, and calendar state.",
  },
  {
    icon: Flag,
    title: "Nations",
    description:
      "Define the political units of each world. Nations own settlements, command armies, and drive diplomatic and trade relationships.",
  },
  {
    icon: Building2,
    title: "Settlements",
    description:
      "Manage cities, towns, and outposts within nations. Settlements house citizens, buildings, and production chains.",
  },
  {
    icon: Users,
    title: "Citizens",
    description:
      "Track population, roles, and jobs within settlements. Citizens are the labor force and social fabric of the simulation.",
  },
  {
    icon: Package,
    title: "Resources",
    description:
      "Monitor deposits, production, and trade goods. Resources flow through settlements and drive economic activity.",
  },
  {
    icon: Calendar,
    title: "Turns & Calendar",
    description:
      "Advance time through structured turns. The calendar tracks events, seasons, and historical progression across the simulation.",
  },
] as const;

export function HomeCapabilitySection(): JSX.Element {
  return (
    <section
      aria-label="Planned feature areas"
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {CAPABILITY_CARDS.map(({ icon: cardIcon, title, description }) => {
        const CardIcon = cardIcon;
        return (
          <article
            key={title}
            className="rounded-2xl border bg-card p-4 shadow-sm"
          >
            <div className="mb-3 flex items-center gap-2">
              <CardIcon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <h2 className="font-medium">{title}</h2>
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
          </article>
        );
      })}
    </section>
  );
}
