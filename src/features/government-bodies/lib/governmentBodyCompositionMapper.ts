// Single place translating between the in-app BodyCompositionRule shape
// (camelCase, shared cross-runtime) and the government_bodies.composition_json
// DB row shape (snake_case, enforced by the composition_valid check
// constraint in 20261005000000_add_government_bodies.sql). #1157: the form
// and resolveBodyMembers must stay camelCase everywhere except this boundary.
import type { BodyCompositionRule } from "@/shared/government";
import type { Json } from "@/types/database";

import {
  dbBodyCompositionSchema,
  type DbBodyCompositionRule,
} from "../schemas/governmentBodySchemas";

export type { DbBodyCompositionRule };

function toDbCompositionRule(rule: BodyCompositionRule): DbBodyCompositionRule {
  switch (rule.kind) {
    case "office_type":
      return { kind: rule.kind, office_type_id: rule.officeTypeId };
    case "citizens":
      return { kind: rule.kind, citizen_ids: [...rule.citizenIds] };
    case "ruler":
      return { kind: rule.kind };
    case "settlement_managers":
      return rule.settlementIds === undefined
        ? { kind: rule.kind }
        : { kind: rule.kind, settlement_ids: [...rule.settlementIds] };
  }
}

function fromDbCompositionRule(
  row: DbBodyCompositionRule,
): BodyCompositionRule {
  switch (row.kind) {
    case "office_type":
      return { kind: row.kind, officeTypeId: row.office_type_id };
    case "citizens":
      return { kind: row.kind, citizenIds: row.citizen_ids };
    case "ruler":
      return { kind: row.kind };
    case "settlement_managers":
      return row.settlement_ids === undefined
        ? { kind: row.kind }
        : { kind: row.kind, settlementIds: row.settlement_ids };
  }
}

// Maps + re-validates against the DB shape schema so a mismatch (e.g. an
// empty citizen_ids array) throws here instead of round-tripping to Postgres
// as a check-constraint violation.
// Cast to Json (not just the parsed shape) so this drops straight into a
// Supabase insert/update payload: PostgREST's generated Json type disallows
// readonly arrays, which the DB shape schema's parsed output otherwise is.
export function toDbComposition(
  composition: readonly BodyCompositionRule[],
): Json {
  return dbBodyCompositionSchema.parse(composition.map(toDbCompositionRule));
}

// Parses a raw composition_json column value (unknown at the client
// boundary) into the in-app camelCase shape.
export function fromDbComposition(
  compositionJson: unknown,
): readonly BodyCompositionRule[] {
  return dbBodyCompositionSchema
    .parse(compositionJson)
    .map(fromDbCompositionRule);
}
