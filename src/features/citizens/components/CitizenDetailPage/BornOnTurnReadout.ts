import type { Citizen } from "../../types/citizenTypes";

export function bornOnTurnReadout(citizen: Pick<Citizen, "bornOnTurnNumber">): {
  readonly tooltip: string;
  readonly value: string | null;
} {
  const { bornOnTurnNumber } = citizen;
  if (bornOnTurnNumber === null) {
    return {
      tooltip: "This citizen's birth turn was not recorded",
      value: null,
    };
  }
  if (bornOnTurnNumber < 0) {
    return {
      tooltip: "This citizen existed before the simulation began",
      value: "Before simulation",
    };
  }
  return {
    tooltip: "The turn number this citizen was born on",
    value: String(bornOnTurnNumber),
  };
}
