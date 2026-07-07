import {
  GOVERNMENT_RULES,
  type GovernmentType,
  type OfficeType,
} from "./governmentTypes.ts";

export type OfficeHolder = {
  readonly officeType: OfficeType;
  readonly citizenId: string;
};

export type CitizenSuccessionInfo = {
  readonly citizenId: string;
  readonly status: "alive" | "dead";
  readonly parentACitizenId: string | null;
  readonly parentBCitizenId: string | null;
  readonly bornOnTurnNumber: number | null;
};

export type ReadinessVotersInput = {
  readonly governmentType: GovernmentType;
  readonly rulerCitizenId: string | null;
  readonly officeHolders: readonly OfficeHolder[];
  readonly settlementManagerCitizenIds: readonly string[];
};

export type SuccessionCandidatesInput = {
  readonly governmentType: GovernmentType;
  readonly rulerCitizenId: string | null;
  readonly citizens: readonly CitizenSuccessionInfo[];
  readonly officeHolders: readonly OfficeHolder[];
  readonly settlementManagerCitizenIds: readonly string[];
};

/**
 * Citizen ids who must ready the nation for turn advancement, per the
 * nation's government readiness mode. Callers apply their own majority/
 * unanimous threshold on top of this roster.
 */
export function getReadinessVoters(
  input: ReadinessVotersInput,
): readonly string[] {
  const rules = GOVERNMENT_RULES[input.governmentType];

  switch (rules.readinessMode) {
    case "ruler_only":
      return input.rulerCitizenId !== null ? [input.rulerCitizenId] : [];
    case "office_majority":
    case "office_unanimous":
      return input.officeHolders
        .filter((holder) => rules.officeTypes.includes(holder.officeType))
        .map((holder) => holder.citizenId);
    case "settlement_managers_unanimous":
      return input.settlementManagerCitizenIds;
    default:
      return [];
  }
}

/**
 * Citizen ids eligible to succeed the current ruler, per the nation's
 * government succession mode. Order is significant for eldest_citizen
 * (eldest first); it is otherwise unordered.
 */
export function getSuccessionCandidates(
  input: SuccessionCandidatesInput,
): readonly string[] {
  const rules = GOVERNMENT_RULES[input.governmentType];

  switch (rules.successionMode) {
    case "hereditary": {
      if (input.rulerCitizenId === null) {
        return [];
      }
      return input.citizens
        .filter(
          (citizen) =>
            citizen.status === "alive" &&
            (citizen.parentACitizenId === input.rulerCitizenId ||
              citizen.parentBCitizenId === input.rulerCitizenId),
        )
        .map((citizen) => citizen.citizenId);
    }
    case "office_election":
      return input.officeHolders
        .filter(
          (holder) =>
            rules.officeTypes.includes(holder.officeType) &&
            holder.officeType !== "ruler",
        )
        .map((holder) => holder.citizenId);
    case "eldest_citizen":
      return input.citizens
        .filter(
          (citizen) =>
            citizen.status === "alive" && citizen.bornOnTurnNumber !== null,
        )
        .sort(
          (a, b) =>
            (a.bornOnTurnNumber as number) - (b.bornOnTurnNumber as number),
        )
        .map((citizen) => citizen.citizenId);
    case "settlement_managers":
      return input.settlementManagerCitizenIds;
    case "none":
      return [];
    default:
      return [];
  }
}
