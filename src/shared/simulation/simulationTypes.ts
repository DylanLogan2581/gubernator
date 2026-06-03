// Simulation type stubs — filled by #B8.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

export type SimulationInput = {
  readonly settlementId: string;
  readonly turnNumber: number;
  readonly worldId: string;
};

export type SimulationOutput = {
  readonly logs: readonly SimulationLogEntry[];
  readonly notifications: readonly SimulationNotification[];
  readonly settlementId: string;
  readonly turnNumber: number;
};

export type SimulationLogEntry = {
  readonly category: string;
  readonly payload: Record<string, unknown>;
  readonly phase: string;
};

export type SimulationNotification = {
  readonly messageText: string;
  readonly notificationType: string;
  readonly recipientUserId: string;
};

export type SimulationContext = {
  readonly input: SimulationInput;
};
