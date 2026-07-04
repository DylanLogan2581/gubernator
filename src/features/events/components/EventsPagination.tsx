import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

import type { JSX, KeyboardEvent } from "react";

export type EventsPaginationProps = {
  readonly pageIndex: number;
  readonly pageCount: number;
  readonly onPageChange: (pageIndex: number) => void;
};

function activateOnEnterOrSpace(
  event: KeyboardEvent<HTMLAnchorElement>,
  activate: () => void,
): void {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  activate();
}

/**
 * Renders the events list pagination controls.
 *
 * `PaginationLink`/`PaginationPrevious`/`PaginationNext` render anchors with
 * no `href` here, which browsers exclude from the tab order and which have
 * no default Enter/Space activation. This component adds `role="button"`,
 * `tabIndex`, and key handlers via props (without touching the vendored
 * `pagination.tsx` primitive) so the controls are keyboard operable, and
 * marks the disabled prev/next edges with `aria-disabled`.
 */
export function EventsPagination({
  pageIndex,
  pageCount,
  onPageChange,
}: EventsPaginationProps): JSX.Element {
  const isPrevDisabled = pageIndex === 0;
  const isNextDisabled = pageIndex >= pageCount - 1;

  const goToPrev = (): void => {
    if (isPrevDisabled) return;
    onPageChange(Math.max(0, pageIndex - 1));
  };
  const goToNext = (): void => {
    if (isNextDisabled) return;
    onPageChange(Math.min(pageCount - 1, pageIndex + 1));
  };

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            role="button"
            tabIndex={0}
            aria-disabled={isPrevDisabled}
            onClick={goToPrev}
            onKeyDown={(event) => {
              activateOnEnterOrSpace(event, goToPrev);
            }}
            className={isPrevDisabled ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>

        {Array.from({ length: pageCount }).map((_, i) => (
          // eslint-disable-next-line @eslint-react/no-array-index-key
          <PaginationItem key={i}>
            <PaginationLink
              role="button"
              tabIndex={0}
              isActive={pageIndex === i}
              onClick={() => {
                onPageChange(i);
              }}
              onKeyDown={(event) => {
                activateOnEnterOrSpace(event, () => {
                  onPageChange(i);
                });
              }}
            >
              {i + 1}
            </PaginationLink>
          </PaginationItem>
        ))}

        <PaginationItem>
          <PaginationNext
            role="button"
            tabIndex={0}
            aria-disabled={isNextDisabled}
            onClick={goToNext}
            onKeyDown={(event) => {
              activateOnEnterOrSpace(event, goToNext);
            }}
            className={isNextDisabled ? "pointer-events-none opacity-50" : ""}
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
