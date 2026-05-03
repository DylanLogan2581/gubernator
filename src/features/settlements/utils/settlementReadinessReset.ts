import type { Database } from "@/types/database";

type SettlementRow = Database["public"]["Tables"]["settlements"]["Row"];
type SettlementUpdate = Database["public"]["Tables"]["settlements"]["Update"];

export type SettlementReadinessResetRow = Pick<
  SettlementRow,
  "auto_ready_enabled" | "id"
>;

export type SettlementReadinessResetUpdatePayload = Required<
  Pick<SettlementUpdate, "is_ready_current_turn" | "ready_set_at">
>;

export type SettlementReadinessResetUpdate = {
  readonly id: string;
  readonly payload: SettlementReadinessResetUpdatePayload;
};

export function createSettlementReadinessResetUpdate(
  row: SettlementReadinessResetRow,
): SettlementReadinessResetUpdate {
  return {
    id: row.id,
    payload: createSettlementReadinessResetUpdatePayload(row),
  };
}

export function createSettlementReadinessResetUpdates(
  rows: readonly SettlementReadinessResetRow[],
): SettlementReadinessResetUpdate[] {
  return rows.map(createSettlementReadinessResetUpdate);
}

export function createSettlementReadinessResetUpdatePayload(
  row: SettlementReadinessResetRow,
): SettlementReadinessResetUpdatePayload {
  return {
    is_ready_current_turn: row.auto_ready_enabled,
    ready_set_at: null,
  };
}
