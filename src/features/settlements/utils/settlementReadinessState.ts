// Settlement readiness state machine.
//
// The DB shape has three signals:
//   - is_ready_current_turn  (boolean)   — set by manual ready action or auto-reset on turn advance
//   - auto_ready_enabled     (boolean)   — sticky preference; applied at each turn advance
//   - ready_set_at           (timestamptz | null) — when manual ready was set; cleared on turn advance
//
// On turn advance (migration 20260503000001): is_ready_current_turn := auto_ready_enabled,
// ready_set_at := null.
//
// Effective readiness is `is_ready_current_turn OR auto_ready_enabled`: once auto-ready is on, the
// settlement counts as ready regardless of the underlying is_ready_current_turn flag, since
// auto-ready guarantees it will be applied at the next turn advance.
//
// Truth table — legal (autoReadyEnabled, isReadyCurrentTurn) combinations and their UI state:
//   false, false → "not-ready",      isReadyForCurrentTurn=false  initial state or after turn
//                                                                 advance with auto off
//   false, true  → "manually-ready", isReadyForCurrentTurn=true   user set ready this turn via
//                                                                 set_settlement_readiness(true)
//   true,  false → "auto-ready",     isReadyForCurrentTurn=true   auto-ready enabled mid-turn;
//                                                                 counts as ready now, applied at
//                                                                 next turn advance
//   true,  true  → "auto-ready",     isReadyForCurrentTurn=true   normal state after turn advance
//                                                                 with auto on
//
// Legal transitions:
//   not-ready      → manually-ready         set_settlement_readiness(true)          [manage permission]
//   manually-ready → not-ready              set_settlement_readiness(false)         [manage permission]
//   any            → auto-ready             set_settlement_auto_ready(true)         [admin permission]
//   auto-ready     → not-ready | manually-ready  set_settlement_auto_ready(false)   [admin permission]
//   any            → not-ready | auto-ready  turn advance resets is_ready_current_turn = auto_ready_enabled

export type SettlementReadinessKind =
  | "auto-ready"
  | "manually-ready"
  | "not-ready";

export type SettlementReadinessStateInput = {
  readonly autoReadyEnabled: boolean;
  readonly isReadyCurrentTurn: boolean;
};

export type SettlementReadinessState =
  | { readonly isReadyForCurrentTurn: true; readonly kind: "auto-ready" }
  | { readonly isReadyForCurrentTurn: true; readonly kind: "manually-ready" }
  | { readonly isReadyForCurrentTurn: false; readonly kind: "not-ready" };

export function deriveSettlementReadinessState(
  input: SettlementReadinessStateInput,
): SettlementReadinessState {
  if (input.autoReadyEnabled) {
    return { isReadyForCurrentTurn: true, kind: "auto-ready" };
  }
  if (input.isReadyCurrentTurn) {
    return { isReadyForCurrentTurn: true, kind: "manually-ready" };
  }
  return { isReadyForCurrentTurn: false, kind: "not-ready" };
}
