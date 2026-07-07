import type { Citizen } from "../../types/citizenTypes";

export function bornOnTurnReadout(citizen: Pick<Citizen, "bornOnTurnNumber">): {
  readonly tooltip?: string;
  readonly value: string | null;
} {
  const { bornOnTurnNumber } = citizen;
  if (bornOnTurnNumber === null) {
    return { value: null };
  }
  if (bornOnTurnNumber < 0) {
    return {
      tooltip: "This citizen existed before the simulation began",
      value: "Before simulation",
    };
  }
  return { value: String(bornOnTurnNumber) };
}
