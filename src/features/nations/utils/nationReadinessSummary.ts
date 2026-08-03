import { formatNationGovernmentType } from "../types/nationTypes";

import type { NationReadinessListItem } from "../types/nationReadinessTypes";

// Nations with no settlements have nobody to hold them accountable for
// readiness (no ruler, no settlement managers) — they never block advance.
export function isNationReadinessBlocking(
  item: NationReadinessListItem,
): boolean {
  return item.hasSettlements && !item.isReady;
}

export function getBlockingNations(
  items: readonly NationReadinessListItem[],
): readonly NationReadinessListItem[] {
  return items.filter(isNationReadinessBlocking);
}

export function getReadinessVoterLabel(
  readinessMode: NationReadinessListItem["readinessMode"],
): string {
  switch (readinessMode) {
    case "office_majority":
      return "senators";
    case "office_unanimous":
      return "elders";
    case "settlement_managers_unanimous":
      return "settlement managers";
    case "ruler_only":
      return "ruler";
  }
}

// e.g. "Republic — 2/5 senators voted"
export function formatNationReadinessVoteProgress(
  item: NationReadinessListItem,
): string {
  const governmentLabel = formatNationGovernmentType(item.governmentType);
  const voterLabel = getReadinessVoterLabel(item.readinessMode);

  return `${governmentLabel} — ${item.trueVoteCount.toString()}/${item.eligibleVoterCount.toString()} ${voterLabel} voted`;
}
