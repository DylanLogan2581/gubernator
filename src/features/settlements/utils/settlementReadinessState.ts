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
// Truth table — legal (autoReadyEnabled, isReadyCurrentTurn) combinations and their UI state:
//   false, false → "not-ready",      isReadyForCurrentTurn=false  initial state or after turn
//                                                                 advance with auto off
//   false, true  → "manually-ready", isReadyForCurrentTurn=true   user set ready this turn via
//                                                                 set_settlement_readiness(true)
//   true,  false → "auto-ready",     isReadyForCurrentTurn=false  auto-ready just enabled mid-turn;
//                                                                 takes effect at next turn advance
//   true,  true  → "auto-ready",     isReadyForCurrentTurn=true   normal state after turn advance
//                                                                 with auto on
//
// `kind` is a display modifier (does auto-ready govern this settlement?) that is independent of
// `isReadyForCurrentTurn`, which always mirrors the underlying is_ready_current_turn flag. A
// settlement can be "auto-ready" and still not ready for the current turn (enabled mid-turn,
// before the next advance applies it).
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
  | { readonly isReadyForCurrentTurn: false; readonly kind: "auto-ready" }
  | { readonly isReadyForCurrentTurn: true; readonly kind: "manually-ready" }
  | { readonly isReadyForCurrentTurn: false; readonly kind: "not-ready" };

export function deriveSettlementReadinessState(
  input: SettlementReadinessStateInput,
): SettlementReadinessState {
  if (input.autoReadyEnabled) {
    return {
      isReadyForCurrentTurn: input.isReadyCurrentTurn,
      kind: "auto-ready",
    };
  }
  if (input.isReadyCurrentTurn) {
    return { isReadyForCurrentTurn: true, kind: "manually-ready" };
  }
  return { isReadyForCurrentTurn: false, kind: "not-ready" };
}
