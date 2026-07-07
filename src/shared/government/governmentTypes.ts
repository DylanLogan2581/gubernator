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

/**
 * Nation office types tracked in public.nation_offices (issue #1079). Distinct
 * from OfficeType above: those drive readiness/succession derivations
 * (ruler/settlement_manager included), these are officeholder appointments a
 * nation manager makes directly. treasurer and bank_governor are economy
 * roles allowed for every government type (central bank work lands later);
 * the remaining four are each tied to one government's legislative/religious
 * body. No government has a per-type max in v1.
 */
export const NATION_OFFICE_TYPES = [
  "senator",
  "elder",
  "clergy",
  "chancellor",
  "treasurer",
  "bank_governor",
  "delegate",
] as const;

export type NationOfficeType = (typeof NATION_OFFICE_TYPES)[number];

export const ALLOWED_NATION_OFFICE_TYPES: Readonly<
  Record<GovernmentType, readonly NationOfficeType[]>
> = {
  monarchy: ["chancellor", "treasurer", "bank_governor"],
  republic: ["senator", "treasurer", "bank_governor"],
  theocracy: ["clergy", "treasurer", "bank_governor"],
  tribal_council: ["elder", "treasurer", "bank_governor"],
  confederation: ["delegate", "treasurer", "bank_governor"],
  despotism: ["chancellor", "treasurer", "bank_governor"],
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
