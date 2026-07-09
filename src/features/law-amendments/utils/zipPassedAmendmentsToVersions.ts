import type { LawAmendment } from "../types/lawAmendmentTypes";

type VersionLike = { readonly version: number };

// Best-effort passed-amendment -> enacted-version link (#1120). There is no
// foreign key from law_amendments to law_document_versions, but the RPCs
// guarantee an invariant we can rely on: version 1 is always created by
// create_law_document (no amendment); every version after that is created
// by exactly one amendment's apply (decree instant-apply, or a vote-kind
// amendment passing), in the same chronological order the amendments
// resolved. So: sort versions ascending (dropping v1), sort passed
// amendments ascending by resolvedTurnNumber, and zip positionally -- the
// i-th passed amendment (0-indexed) corresponds to version i+2.
export function zipPassedAmendmentsToVersions(
  amendments: readonly LawAmendment[],
  versions: readonly VersionLike[],
): ReadonlyMap<string, number> {
  const passedAmendments = amendments
    .filter((amendment) => amendment.status === "passed")
    .slice()
    .sort((a, b) => (a.resolvedTurnNumber ?? 0) - (b.resolvedTurnNumber ?? 0));

  const sortedVersionNumbers = versions
    .map((version) => version.version)
    .filter((version) => version > 1)
    .sort((a, b) => a - b);

  const linkByAmendmentId = new Map<string, number>();
  passedAmendments.forEach((amendment, index) => {
    const versionNumber = sortedVersionNumbers[index];
    if (versionNumber !== undefined) {
      linkByAmendmentId.set(amendment.id, versionNumber);
    }
  });

  return linkByAmendmentId;
}
