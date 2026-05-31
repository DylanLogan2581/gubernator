import { type JSX, type ReactNode } from "react";

type DialogShellProps = {
  readonly children: ReactNode;
};

export function DialogShell({ children }: DialogShellProps): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-background/80">
      <div className="flex min-h-full items-center justify-center p-4">
        {children}
      </div>
    </div>
  );
}
