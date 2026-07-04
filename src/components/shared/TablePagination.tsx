import { ChevronsLeftIcon, ChevronsRightIcon } from "lucide-react";

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";

import type { JSX, KeyboardEvent } from "react";

export type TablePaginationProps = {
  /** 0-based current page index. */
  readonly page: number;
  readonly pageCount: number;
  readonly onPageChange: (page: number) => void;
  /** Disables all controls, e.g. while a page fetch is in flight. */
  readonly isDisabled?: boolean;
};

const SIBLING_COUNT = 1;
const BOUNDARY_COUNT = 1;

type PageItem = number | "ellipsis";

function range(start: number, end: number): number[] {
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

/** `currentPage`/return values are 1-based display page numbers. */
function getPageItems(currentPage: number, totalPages: number): PageItem[] {
  const totalPageNumbers = SIBLING_COUNT * 2 + BOUNDARY_COUNT * 2 + 3;
  if (totalPages <= totalPageNumbers) return range(1, totalPages);

  const leftSibling = Math.max(currentPage - SIBLING_COUNT, BOUNDARY_COUNT + 2);
  const rightSibling = Math.min(
    currentPage + SIBLING_COUNT,
    totalPages - BOUNDARY_COUNT - 1,
  );

  const showLeftEllipsis = leftSibling > BOUNDARY_COUNT + 2;
  const showRightEllipsis = rightSibling < totalPages - BOUNDARY_COUNT - 1;

  const firstPages = range(1, BOUNDARY_COUNT);
  const lastPages = range(totalPages - BOUNDARY_COUNT + 1, totalPages);

  if (!showLeftEllipsis && showRightEllipsis) {
    const leftItemCount = BOUNDARY_COUNT + SIBLING_COUNT * 2 + 2;
    return [...range(1, leftItemCount), "ellipsis", ...lastPages];
  }
  if (showLeftEllipsis && !showRightEllipsis) {
    const rightItemCount = BOUNDARY_COUNT + SIBLING_COUNT * 2 + 2;
    return [
      ...firstPages,
      "ellipsis",
      ...range(totalPages - rightItemCount + 1, totalPages),
    ];
  }
  return [
    ...firstPages,
    "ellipsis",
    ...range(leftSibling, rightSibling),
    "ellipsis",
    ...lastPages,
  ];
}

function activateOnEnterOrSpace(
  event: KeyboardEvent<HTMLAnchorElement>,
  activate: () => void,
): void {
  if (event.key !== "Enter" && event.key !== " ") return;
  event.preventDefault();
  activate();
}

/**
 * Shared pagination control for tables/lists. Renders a bounded page-number
 * strip (with ellipsis when truncated) plus first/prev/next/last controls
 * and a "Page X of Y" label.
 */
export function TablePagination({
  page,
  pageCount,
  onPageChange,
  isDisabled = false,
}: TablePaginationProps): JSX.Element {
  const safePageCount = Math.max(pageCount, 1);
  const currentPage = Math.min(Math.max(page, 0), safePageCount - 1) + 1;
  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === safePageCount;

  const goToPage = (targetPage: number): void => {
    if (isDisabled) return;
    onPageChange(Math.min(Math.max(targetPage, 0), safePageCount - 1));
  };

  const goFirst = (): void => {
    if (isFirstPage || isDisabled) return;
    goToPage(0);
  };
  const goPrevious = (): void => {
    if (isFirstPage || isDisabled) return;
    goToPage(currentPage - 2);
  };
  const goNext = (): void => {
    if (isLastPage || isDisabled) return;
    goToPage(currentPage);
  };
  const goLast = (): void => {
    if (isLastPage || isDisabled) return;
    goToPage(safePageCount - 1);
  };

  const controlClassName = (disabled: boolean): string =>
    cn(disabled ? "pointer-events-none opacity-50" : "");

  const pageItems = getPageItems(currentPage, safePageCount);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Pagination className="mx-0 w-auto justify-start">
        <PaginationContent>
          <PaginationItem>
            <PaginationLink
              role="button"
              tabIndex={0}
              aria-label="Go to first page"
              aria-disabled={isFirstPage || isDisabled}
              className={controlClassName(isFirstPage || isDisabled)}
              onClick={goFirst}
              onKeyDown={(event) => {
                activateOnEnterOrSpace(event, goFirst);
              }}
            >
              <ChevronsLeftIcon />
              <span className="sr-only">First</span>
            </PaginationLink>
          </PaginationItem>

          <PaginationItem>
            <PaginationPrevious
              role="button"
              tabIndex={0}
              aria-disabled={isFirstPage || isDisabled}
              className={controlClassName(isFirstPage || isDisabled)}
              onClick={goPrevious}
              onKeyDown={(event) => {
                activateOnEnterOrSpace(event, goPrevious);
              }}
            />
          </PaginationItem>

          {pageItems.map((item, index) =>
            item === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${index.toString()}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item}>
                <PaginationLink
                  role="button"
                  tabIndex={0}
                  isActive={item === currentPage}
                  aria-disabled={isDisabled}
                  className={controlClassName(isDisabled)}
                  onClick={() => {
                    goToPage(item - 1);
                  }}
                  onKeyDown={(event) => {
                    activateOnEnterOrSpace(event, () => {
                      goToPage(item - 1);
                    });
                  }}
                >
                  {item}
                </PaginationLink>
              </PaginationItem>
            ),
          )}

          <PaginationItem>
            <PaginationNext
              role="button"
              tabIndex={0}
              aria-disabled={isLastPage || isDisabled}
              className={controlClassName(isLastPage || isDisabled)}
              onClick={goNext}
              onKeyDown={(event) => {
                activateOnEnterOrSpace(event, goNext);
              }}
            />
          </PaginationItem>

          <PaginationItem>
            <PaginationLink
              role="button"
              tabIndex={0}
              aria-label="Go to last page"
              aria-disabled={isLastPage || isDisabled}
              className={controlClassName(isLastPage || isDisabled)}
              onClick={goLast}
              onKeyDown={(event) => {
                activateOnEnterOrSpace(event, goLast);
              }}
            >
              <ChevronsRightIcon />
              <span className="sr-only">Last</span>
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      <p className="text-xs whitespace-nowrap text-muted-foreground">
        Page {currentPage} of {safePageCount}
      </p>
    </div>
  );
}
