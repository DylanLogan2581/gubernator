import { Bell } from "lucide-react";
import { type JSX, type ReactNode } from "react";

import { PageHeader } from "@/components/shared/PageHeader";

type NotificationsPageFrameProps = {
  readonly children: ReactNode;
};

export function NotificationsPageFrame({
  children,
}: NotificationsPageFrameProps): JSX.Element {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        icon={Bell}
        title="Notifications"
        description="View and manage all your notifications in one place"
      />
      {children}
    </div>
  );
}
