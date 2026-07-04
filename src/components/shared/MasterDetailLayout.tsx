import { type JSX, type ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";

type MasterDetailLayoutProps = {
  readonly list: ReactNode;
  readonly detail: ReactNode | null;
  readonly detailTitle: ReactNode;
  readonly onCloseDetail: () => void;
};

/**
 * List (2/3) + selected-item detail panel (1/3) on wide screens; the detail
 * panel moves into a `Sheet` on narrow screens. Selection state lives in the
 * caller (no route change on select).
 */
export function MasterDetailLayout({
  list,
  detail,
  detailTitle,
  onCloseDetail,
}: MasterDetailLayoutProps): JSX.Element {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <>
        {list}
        <Sheet
          open={detail !== null}
          onOpenChange={(open) => {
            if (!open) onCloseDetail();
          }}
        >
          <SheetContent>
            <SheetHeader>
              <SheetTitle>{detailTitle}</SheetTitle>
            </SheetHeader>
            <div className="grid gap-3 overflow-y-auto px-4 pb-4">{detail}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">{list}</div>
      {detail !== null ? (
        <Card className="self-start lg:col-span-1">
          <CardHeader>
            <CardTitle>{detailTitle}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">{detail}</CardContent>
        </Card>
      ) : null}
    </div>
  );
}
