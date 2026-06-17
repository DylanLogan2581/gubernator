import { type JSX, type ReactNode } from "react";

type NotificationsPageFrameProps = {
  readonly children: ReactNode;
};

export function NotificationsPageFrame({
  children,
}: NotificationsPageFrameProps): JSX.Element {
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Notifications</h1>
        <p className="text-muted-foreground">
          View and manage all your notifications in one place
        </p>
      </div>
      {children}
    </div>
  );
}
