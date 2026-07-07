import { type JSX, type ReactNode } from "react";

type EventsPageFrameProps = {
  readonly children: ReactNode;
};

export function EventsPageFrame({
  children,
}: EventsPageFrameProps): JSX.Element {
  return (
    <div className="space-y-4 pb-8">
      <main>{children}</main>
    </div>
  );
}
