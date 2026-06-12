import { ChevronRight } from "lucide-react";
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

  const deepLinkElement =
    deepLink !== null ? (
      <Button variant="ghost" size="sm" asChild className="text-xs h-7 px-2">
        <a href={deepLink.href}>{deepLink.label}</a>
      </Button>
    ) : null;

  return (
    <div
      className={`flex items-start justify-between gap-4 p-4 transition-colors hover:bg-muted ${
        !notification.isRead ? "bg-muted/50" : ""
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium">{notification.messageText}</p>
          {!notification.isRead ? (
            <span className="inline-block size-2 rounded-full bg-primary shrink-0" />
          ) : null}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {/* eslint-disable-next-line no-restricted-syntax */}
          {new Date(notification.generatedAt).toLocaleString()}
        </p>
        <div className="flex gap-2 mt-2">{deepLinkElement}</div>
      </div>

      {!notification.isRead ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onMarkRead}
          disabled={isMarkingRead}
          className="shrink-0"
        >
          <ChevronRight className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
