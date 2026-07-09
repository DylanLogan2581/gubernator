import type { VoteThreshold } from "@/shared/government";

// Smallest yes-count that meets a threshold against a member count -- a
// simple derived preview number for the "Y/M, needs T" tally display
// (#1120). Deliberately not the full evaluateVote/tallyChamber machinery
// from src/shared/government/amendmentProcedure.ts: that module's tri-state
// (yes/no/abstain) tally doesn't match this feature's boolean-only
// law_amendment_votes rows -- see the task spec's note on this. The actual
// pass/fail decision always happens server-side in cast_law_amendment_vote;
// this is advisory UI only.
export function neededYesVotes(
  threshold: VoteThreshold,
  memberCount: number,
): number {
  if (memberCount <= 0) {
    return 0;
  }
  switch (threshold) {
    case "majority":
      return Math.floor(memberCount / 2) + 1;
    case "two_thirds":
      return Math.ceil((memberCount * 2) / 3);
    case "three_quarters":
      return Math.ceil((memberCount * 3) / 4);
    case "unanimous":
      return memberCount;
  }
}

// "Expires in N turns" / "Expires this turn" / "Expired" -- simple turn-count
// arithmetic, not the calendar month/year relative-difference machinery
// (getRelativeTurnDifference), which is overkill for a plain turn countdown
// and requires a world calendar config this feature doesn't otherwise need.
export function formatTurnsUntilDeadline(
  deadlineTurnNumber: number,
  currentTurnNumber: number,
): string {
  const turnsRemaining = deadlineTurnNumber - currentTurnNumber;
  if (turnsRemaining > 0) {
    return `Expires in ${turnsRemaining} ${turnsRemaining === 1 ? "turn" : "turns"}`;
  }
  if (turnsRemaining === 0) {
    return "Expires this turn";
  }
  return "Expired";
}
