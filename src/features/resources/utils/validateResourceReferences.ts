import type { ReferenceIssue } from "@/lib/validateReferenceHelpers";

// Resources are a foundational entity. No cross-entity reference fields exist
// today; this type and validator are structural placeholders for future additions.
type ResourceReferencePayload = Record<string, never>;

export type ResourceReferenceIssue = ReferenceIssue;

// Pre-flight reference check for resource create/update payloads.
// Returns UI-friendly issues when referenced entities are absent from the
// provided world-scoped lists. Cross-table consistency is also enforced at
// the DB layer; this helper surfaces errors before the round-trip.
export function validateResourceReferencesAgainstWorld(
  _payload: ResourceReferencePayload,
): readonly ResourceReferenceIssue[] {
  return [];
}
