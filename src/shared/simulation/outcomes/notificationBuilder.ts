// Notification builder stub — filled by subsequent issues.
//
// Cross-runtime module: no browser APIs, no @/ alias, explicit .ts extensions.

import type { SimulationNotification } from "../simulationTypes.ts";

export type NotificationBuildInput = {
  readonly messageText: string;
  readonly notificationType: string;
  readonly recipientUserId: string;
};

export function buildNotification(
  input: NotificationBuildInput,
): SimulationNotification {
  return {
    messageText: input.messageText,
    notificationType: input.notificationType,
    recipientUserId: input.recipientUserId,
  };
}
