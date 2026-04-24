import { Bell } from "lucide-react";
import { type JSX } from "react";

import { Button } from "@/components/ui/button";

export function NotificationBellPlaceholder(): JSX.Element {
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Notifications (not yet available)"
      disabled
    >
      <Bell className="size-4" />
    </Button>
  );
}
