import { AlertCircle, AlertTriangle } from "lucide-react";
import { type JSX } from "react";

import { Button } from "@/components/ui/button";
import { type AllNotification, getDeepLink } from "@/features/notifications";

type NotificationListItemProps = {
  readonly notification: AllNotification;
  readonly onMarkRead: () => void;
  readonly isMarkingRead: boolean;
};

export function NotificationListItem({
  notification,
  onMarkRead,
  isMarkingRead,
}: NotificationListItemProps): JSX.Element {
  const deepLink = getDeepLink(notification);

  const contextParts = [
    notification.worldName,
    notification.nationName,
    notification.settlementName,
  ].filter((name): name is string => name !== null);

  const severityIcon =
    notification.severity === "critical" ? (
      <AlertCircle className="size-4 shrink-0 text-destructive" />
    ) : notification.severity === "warning" ? (
      <AlertTriangle className="size-4 shrink-0 text-amber-500" />
    ) : null;

  return (
    <div
      className={`flex items-start gap-4 p-4 transition-colors hover:bg-muted ${
        !notification.isRead ? "bg-muted/50" : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {severityIcon}
          <p className="text-sm font-medium">{notification.messageText}</p>
          {!notification.isRead ? (
            <span className="inline-block size-2 rounded-full bg-primary shrink-0" />
          ) : null}
        </div>
        {contextParts.length > 0 ? (
          <p className="text-xs text-muted-foreground mt-0.5">
            {contextParts.join(" · ")}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground mt-1">
          {/* eslint-disable-next-line no-restricted-syntax */}
          {new Date(notification.generatedAt).toLocaleString()}
        </p>
        <div className="flex gap-2 mt-2">
          {deepLink !== null ? (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-xs h-7 px-2"
            >
              <a href={deepLink.href}>{deepLink.label}</a>
            </Button>
          ) : null}
          {!notification.isRead ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMarkRead}
              disabled={isMarkingRead}
              className="text-xs h-7 px-2"
            >
              Clear
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
