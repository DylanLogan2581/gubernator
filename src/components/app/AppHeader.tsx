import { type JSX, type ReactNode } from "react";

import { APP_DESCRIPTION, APP_NAME } from "@/lib/appMeta";

import { NotificationBellPlaceholder } from "./NotificationBellPlaceholder";

type AppHeaderProps = {
  readonly action?: ReactNode;
};

export function AppHeader({ action }: AppHeaderProps): JSX.Element {
  return (
    <header className="sticky top-0 z-10 py-4">
      <div className="rounded-2xl border border-border/70 bg-background/85 px-4 py-3 shadow-sm backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo.png"
              alt="Gubernator logo"
              className="size-10 rounded-xl object-contain"
            />
            <div>
              <p className="text-sm font-medium">{APP_NAME}</p>
              <p className="text-xs text-muted-foreground">{APP_DESCRIPTION}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <NotificationBellPlaceholder />
            {action}
          </div>
        </div>
      </div>
    </header>
  );
}
