export const NPC_FLAVOR_SAMPLES = {
  traits: [
    "curious about everything, especially danger",
    "methodical to a fault",
    "speaks in understatements",
    "disarmingly cheerful",
    "fiercely protective of chosen family",
    "keeps a meticulous journal",
  ],
  contradictions: [
    "stoic but theatrical in private",
    "generous with strangers, cold with friends",
    "values honesty, lies constantly about trivial things",
    "loves peace, thrives in conflict",
    "deeply superstitious but publicly skeptical",
    "craves solitude yet hates to be forgotten",
  ],
  goals: [
    "reclaim a lost family heirloom",
    "prove a long-held theory correct",
    "outlive every enemy",
    "build something that lasts a century",
    "find the person who taught them their first skill",
    "die without owing anyone a favor",
  ],
  flaws: [
    "impatient with slow thinkers",
    "cannot resist a wager",
    "holds grudges for decades",
    "overestimates their own charm",
    "freezes when given too many options",
    "compulsively corrects other people's grammar",
  ],
} as const satisfies Record<string, readonly string[]>;

export function pickNextSample(
  entries: readonly string[],
  samples: readonly string[],
): string | null {
  return samples.find((s) => !entries.includes(s)) ?? null;
}
