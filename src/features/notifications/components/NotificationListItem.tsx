import { Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { type JSX } from "react";

import { IconChip, type IconChipTone } from "@/components/shared/IconChip";
import { Button } from "@/components/ui/button";
import { type AllNotification } from "@/features/notifications";
import { formatDate } from "@/lib/formatDate";
import { cn } from "@/lib/utils";

import { getNotificationEntityLinks } from "../utils/notificationEntityLinks";
import { getNotificationTypeIcon } from "../utils/notificationTypeIcons";

type NotificationListItemProps = {
  readonly notification: AllNotification;
  readonly onMarkRead: () => void;
  readonly isMarkingRead: boolean;
};

function severityIconTone(severity: AllNotification["severity"]): IconChipTone {
  if (severity === "critical") return "destructive";
  if (severity === "warning") return "warning";
  return "default";
}

export function NotificationListItem({
  notification,
  onMarkRead,
  isMarkingRead,
}: NotificationListItemProps): JSX.Element {
  const entityLinks = getNotificationEntityLinks(notification);

  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2 transition-colors hover:bg-muted",
        !notification.isRead && "bg-muted/50",
      )}
    >
      <IconChip
        icon={getNotificationTypeIcon(notification.notificationType)}
        tone={severityIconTone(notification.severity)}
        size="sm"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">
          {notification.messageText}
          {entityLinks.length > 0 ? (
            <>
              {" · "}
              {entityLinks.map((link, index) => (
                <span key={link.key}>
                  {index > 0 ? ", " : null}
                  {link.href !== null ? (
                    <Link
                      to={link.href}
                      className="font-medium text-foreground underline-offset-2 hover:underline"
                    >
                      {link.label}
                    </Link>
                  ) : (
                    link.label
                  )}
                </span>
              ))}
            </>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground">
          {formatDate(notification.generatedAt)}
        </p>
      </div>

      {!notification.isRead ? (
        <span
          aria-hidden="true"
          className="size-2 shrink-0 rounded-full bg-primary"
        />
      ) : null}

      {!notification.isRead ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onMarkRead}
          disabled={isMarkingRead}
          aria-label="Mark as read"
          className="h-7 shrink-0 px-2 text-xs opacity-0 focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Check aria-hidden="true" />
          Mark read
        </Button>
      ) : null}
    </div>
  );
}
