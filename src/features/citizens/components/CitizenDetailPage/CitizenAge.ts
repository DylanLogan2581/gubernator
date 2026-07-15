export function citizenAgeTurns(
  bornOnTurnNumber: number | null,
  currentTurnNumber: number,
): number | null {
  return bornOnTurnNumber === null
    ? null
    : currentTurnNumber - bornOnTurnNumber;
}

// Unknown birth turn or unknown world rule both mean we cannot determine
// child status, so neither gates adult-only content.
export function isBelowPartnershipAge(
  ageTurns: number | null,
  minimumPartnershipAgeTurns: number | null,
): boolean {
  return (
    ageTurns !== null &&
    minimumPartnershipAgeTurns !== null &&
    ageTurns < minimumPartnershipAgeTurns
  );
}
