/**
 * Cross-runtime source of truth for nation government rules.
 *
 * Browser (nations feature) and the Deno edge simulation both consume this
 * module so readiness/succession/office behavior can never drift between
 * the two runtimes. Plain data in, plain data out — no Supabase calls.
 */

export const GOVERNMENT_TYPES = [
  "monarchy",
  "republic",
  "theocracy",
  "tribal_council",
  "confederation",
  "despotism",
] as const;

export type GovernmentType = (typeof GOVERNMENT_TYPES)[number];

/**
 * Who must act to mark a nation ready for turn advancement.
 * - ruler_only: the ruler alone.
 * - office_majority: a majority of a specific office's holders (republic senators).
 * - office_unanimous: every holder of a specific office (tribal_council elders).
 * - settlement_managers_unanimous: every settlement manager in the nation.
 */
export type ReadinessMode =
  | "ruler_only"
  | "office_majority"
  | "office_unanimous"
  | "settlement_managers_unanimous";

/**
 * How a new ruler is determined.
 * - hereditary: living children of the ruler (monarchy).
 * - office_election: current holders of the electing office (republic senators,
 *   theocracy clergy).
 * - eldest_citizen: the eldest living citizen (tribal_council).
 * - settlement_managers: the nation's settlement managers (confederation).
 * - none: no candidate derivation; an admin assigns directly (despotism).
 */
export type SuccessionMode =
  | "hereditary"
  | "office_election"
  | "eldest_citizen"
  | "settlement_managers"
  | "none";

export type OfficeType =
  | "ruler"
  | "senator"
  | "clergy"
  | "elder"
  | "settlement_manager";

export type GovernmentRules = {
  readonly readinessMode: ReadinessMode;
  readonly successionMode: SuccessionMode;
  readonly officeTypes: readonly OfficeType[];
};

export const GOVERNMENT_RULES: Readonly<
  Record<GovernmentType, GovernmentRules>
> = {
  monarchy: {
    readinessMode: "ruler_only",
    successionMode: "hereditary",
    officeTypes: ["ruler"],
  },
  republic: {
    readinessMode: "office_majority",
    successionMode: "office_election",
    officeTypes: ["senator"],
  },
  theocracy: {
    readinessMode: "ruler_only",
    successionMode: "office_election",
    officeTypes: ["ruler", "clergy"],
  },
  tribal_council: {
    readinessMode: "office_unanimous",
    successionMode: "eldest_citizen",
    officeTypes: ["elder"],
  },
  confederation: {
    readinessMode: "settlement_managers_unanimous",
    successionMode: "settlement_managers",
    officeTypes: ["settlement_manager"],
  },
  despotism: {
    readinessMode: "ruler_only",
    successionMode: "none",
    officeTypes: ["ruler"],
  },
};
