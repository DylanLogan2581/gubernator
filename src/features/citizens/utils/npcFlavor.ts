import type { SeededRng } from "@/lib/seededRng";

import type { CitizenAssignment } from "../types/citizenAssignmentTypes";
import type { CitizenAssignmentType } from "../types/citizenTypes";

// Per-world configuration of the option pools the generator draws from.
export type NpcFlavorConfig = {
  readonly contradictions: readonly string[];
  readonly flaws: readonly string[];
  readonly goals: readonly string[];
  readonly traits: readonly string[];
};

// The five slots that drive the rendered flavor sentence.
export type NpcFlavor = {
  readonly contradiction: string;
  readonly flaw: string;
  readonly goal: string;
  readonly trait1: string;
  readonly trait2: string;
};

const EMPTY_FLAVOR: NpcFlavor = {
  contradiction: "",
  flaw: "",
  goal: "",
  trait1: "",
  trait2: "",
};

export const UNASSIGNED_ROLE_LABEL = "Unassigned";

export function generateNpcFlavor(
  config: NpcFlavorConfig,
  rng: SeededRng,
): NpcFlavor {
  const trait1 = pickRandom(config.traits, rng);
  const trait2 = pickDistinct(config.traits, rng, trait1);
  return {
    contradiction: pickRandom(config.contradictions, rng),
    flaw: pickRandom(config.flaws, rng),
    goal: pickRandom(config.goals, rng),
    trait1,
    trait2,
  };
}

export function emptyNpcFlavor(): NpcFlavor {
  return EMPTY_FLAVOR;
}

// Renders the canonical flavor sentence. Exposed as a pure helper so the
// component layer, tests, and any future preview tooling produce identical
// strings.
export function renderNpcFlavorLine(
  flavor: NpcFlavor,
  role: string | null,
): string {
  const roleLabel =
    role === null || role.trim() === "" ? UNASSIGNED_ROLE_LABEL : role.trim();
  const trait1 = orFallback(flavor.trait1, "mysterious");
  const trait2 = orFallback(flavor.trait2, "unreadable");
  const contradiction = orFallback(
    flavor.contradiction,
    "keeps their secrets close",
  );
  const goal = orFallback(flavor.goal, "something they have yet to name");
  const flaw = orFallback(flavor.flaw, "something they will not admit");
  return `A ${roleLabel} who is ${trait1}, ${trait2}, but secretly ${contradiction}. They want ${goal} but are prevented by ${flaw}.`;
}

// Derives the "role" slot for the flavor line from a citizen's current
// assignment. Returns null when the citizen is unassigned so the line falls
// back to the "Unassigned" label.
export function roleLabelForAssignment(
  assignment: CitizenAssignment | null,
): string | null {
  if (assignment === null) {
    return null;
  }
  return roleLabelForAssignmentType(assignment.assignmentType);
}

export function roleLabelForAssignmentType(
  type: CitizenAssignmentType,
): string {
  switch (type) {
    case "construction_project":
      return "Builder";
    case "culling":
      return "Culler";
    case "deposit":
      return "Gatherer";
    case "husbandry":
      return "Herder";
    case "standard_job":
      return "Worker";
    case "trade_route":
      return "Trader";
  }
}

function pickRandom(pool: readonly string[], rng: SeededRng): string {
  if (pool.length === 0) {
    return "";
  }
  const index = Math.floor(rng() * pool.length);
  // Math.floor(rng()) is in [0, pool.length - 1] for rng in [0, 1).
  return pool[index] ?? "";
}

function pickDistinct(
  pool: readonly string[],
  rng: SeededRng,
  exclude: string,
): string {
  if (pool.length === 0) {
    return "";
  }
  if (pool.length === 1) {
    return pool[0] ?? "";
  }
  const filtered = pool.filter((value) => value !== exclude);
  if (filtered.length === 0) {
    return pool[0] ?? "";
  }
  const index = Math.floor(rng() * filtered.length);
  return filtered[index] ?? "";
}

function orFallback(value: string, fallback: string): string {
  const trimmed = value.trim();
  return trimmed === "" ? fallback : trimmed;
}
