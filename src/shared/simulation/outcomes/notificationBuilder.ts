// Notification builder stub — filled by subsequent issues.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type {
  SimulationNotification,
  SimulationNotificationScope,
} from "../simulationTypes.ts";

export type NotificationBuildInput = {
  readonly messageText: string;
  readonly nationId?: string;
  readonly notificationType: string;
  readonly scope: SimulationNotificationScope;
  readonly settlementId?: string;
};

export function buildNotification(
  input: NotificationBuildInput,
): SimulationNotification {
  return {
    messageText: input.messageText,
    nationId: input.nationId,
    notificationType: input.notificationType,
    scope: input.scope,
    settlementId: input.settlementId,
  };
}
