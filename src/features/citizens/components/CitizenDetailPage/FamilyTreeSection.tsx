import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { EmptyState } from "@/components/shared/EmptyState";
import { ErrorState } from "@/components/shared/ErrorState";
import { LoadingState } from "@/components/shared/LoadingState";
import { Card } from "@/components/ui/card";
import { getErrorDescription } from "@/lib/errorUtils";
import { cn } from "@/lib/utils";

import { citizenFamilyTreeQueryOptions } from "../../queries/citizenFamilyTreeQueries";
import { computeFamilyTreeLayout } from "../../utils/familyTreeLayout";

import { StatusChip } from "./Shared";

import type { Citizen, FamilyTreeNode } from "../../types/citizenTypes";
import type {
  FamilyTreeLayout,
  FamilyTreeLayoutEdge,
  FamilyTreeLayoutNode,
} from "../../utils/familyTreeLayout";
import type { JSX, PointerEvent } from "react";

const GENERATION_LABELS: Readonly<Record<number, string>> = {
  [-3]: "Great-grandparents",
  [-2]: "Grandparents",
  [-1]: "Parents",
  0: "Center & partners",
  1: "Children",
  2: "Grandchildren",
  3: "Great-grandchildren",
};

const COLUMN_WIDTH = 210;
const ROW_HEIGHT = 130;
const CARD_WIDTH = 150;
const CARD_HALF_WIDTH = CARD_WIDTH / 2;
const CARD_HALF_HEIGHT = 32;
const HORIZONTAL_PADDING = 240;
const VERTICAL_PADDING = 48;
const LABEL_GUTTER_WIDTH = HORIZONTAL_PADDING - CARD_HALF_WIDTH - 16;
const DRAG_THRESHOLD_PX = 4;

export function CitizenFamilyTreeSection({
  citizen,
}: {
  readonly citizen: Citizen;
}): JSX.Element {
  const familyTreeQuery = useQuery(citizenFamilyTreeQueryOptions(citizen.id));

  return (
    <Card
      aria-labelledby="citizen-family-tree-heading"
      className="grid gap-3 p-4"
    >
      <h2 id="citizen-family-tree-heading" className="text-base font-medium">
        Family tree
      </h2>
      <CitizenFamilyTreeBody citizen={citizen} query={familyTreeQuery} />
    </Card>
  );
}

function CitizenFamilyTreeBody({
  citizen,
  query,
}: {
  readonly citizen: Citizen;
  readonly query: ReturnType<typeof useQuery<readonly FamilyTreeNode[]>>;
}): JSX.Element {
  if (query.isPending) {
    return <LoadingState label="Loading family tree…" />;
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Family tree could not be loaded"
        description={getErrorDescription(query.error)}
      />
    );
  }

  const nodes = query.data;
  const hasRelatives = nodes.some(
    (node) => node.nodePath !== "root" && node.direction !== "unknown",
  );

  if (!hasRelatives) {
    return (
      <EmptyState
        title="No known family recorded"
        description="No ancestors, descendants, or partners are on record for this citizen."
      />
    );
  }

  return (
    <FamilyTreeCanvas
      citizen={citizen}
      layout={computeFamilyTreeLayout(nodes)}
    />
  );
}

function FamilyTreeCanvas({
  citizen,
  layout,
}: {
  readonly citizen: Citizen;
  readonly layout: FamilyTreeLayout;
}): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragStateRef = useRef<{
    active: boolean;
    pointerId: number;
    scrollLeft: number;
    scrollTop: number;
    x: number;
    y: number;
  } | null>(null);

  const toPixelX = (column: number): number =>
    (column - layout.minColumn) * COLUMN_WIDTH + HORIZONTAL_PADDING;
  const toPixelY = (row: number): number =>
    (row - layout.minRow) * ROW_HEIGHT + VERTICAL_PADDING;

  const contentWidth =
    (layout.maxColumn - layout.minColumn) * COLUMN_WIDTH +
    HORIZONTAL_PADDING * 2;
  const contentHeight =
    (layout.maxRow - layout.minRow) * ROW_HEIGHT + VERTICAL_PADDING * 2;

  const generations = [
    ...new Set(layout.nodes.map((layoutNode) => layoutNode.y)),
  ].sort((a, b) => a - b);

  useEffect(() => {
    const container = scrollRef.current;
    if (container === null) {
      return;
    }
    const centerNode = layout.nodes.find(
      (layoutNode) => layoutNode.node.nodePath === layout.centerNodePath,
    );
    if (centerNode === undefined) {
      return;
    }
    container.scrollLeft = Math.max(
      0,
      toPixelX(centerNode.x) - container.clientWidth / 2,
    );
    container.scrollTop = Math.max(
      0,
      toPixelY(centerNode.y) - container.clientHeight / 2,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout.centerNodePath]);

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>): void => {
    if (event.pointerType !== "mouse") {
      return;
    }
    const container = scrollRef.current;
    if (container === null) {
      return;
    }
    dragStateRef.current = {
      active: false,
      pointerId: event.pointerId,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>): void => {
    const dragState = dragStateRef.current;
    const container = scrollRef.current;
    if (dragState === null || container === null) {
      return;
    }
    const dx = event.clientX - dragState.x;
    const dy = event.clientY - dragState.y;
    if (!dragState.active) {
      if (
        Math.abs(dx) < DRAG_THRESHOLD_PX &&
        Math.abs(dy) < DRAG_THRESHOLD_PX
      ) {
        return;
      }
      dragState.active = true;
      container.setPointerCapture(dragState.pointerId);
    }
    container.scrollLeft = dragState.scrollLeft - dx;
    container.scrollTop = dragState.scrollTop - dy;
  };

  const endDrag = (event: PointerEvent<HTMLDivElement>): void => {
    const dragState = dragStateRef.current;
    dragStateRef.current = null;
    if (dragState?.active === true) {
      scrollRef.current?.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div
      ref={scrollRef}
      aria-label="Family tree — pannable, centered on this citizen"
      className="relative h-[420px] cursor-grab overflow-auto rounded-lg border bg-muted/20 active:cursor-grabbing sm:h-[480px]"
      role="group"
      onPointerCancel={endDrag}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
    >
      <div
        className="relative"
        style={{ height: contentHeight, width: contentWidth }}
      >
        <svg
          aria-hidden="true"
          className="absolute inset-0 z-0"
          height={contentHeight}
          width={contentWidth}
        >
          {layout.edges.map((edge) => (
            <FamilyTreeEdgePath
              key={edge.id}
              edge={edge}
              toPixelX={toPixelX}
              toPixelY={toPixelY}
            />
          ))}
        </svg>
        {generations.map((generation) => (
          <div
            key={generation}
            className="absolute z-0 -translate-y-1/2 text-xs font-medium text-muted-foreground"
            style={{
              left: 8,
              top: toPixelY(generation),
              width: LABEL_GUTTER_WIDTH,
            }}
          >
            {GENERATION_LABELS[generation] ?? `Generation ${generation}`}
          </div>
        ))}
        {layout.nodes.map((layoutNode) => (
          <FamilyTreeNodeCard
            key={layoutNode.node.nodePath}
            citizen={citizen}
            layoutNode={layoutNode}
            left={toPixelX(layoutNode.x)}
            top={toPixelY(layoutNode.y)}
          />
        ))}
      </div>
    </div>
  );
}

function FamilyTreeEdgePath({
  edge,
  toPixelX,
  toPixelY,
}: {
  readonly edge: FamilyTreeLayoutEdge;
  readonly toPixelX: (column: number) => number;
  readonly toPixelY: (row: number) => number;
}): JSX.Element {
  const x1 = toPixelX(edge.from.x);
  const y1 = toPixelY(edge.from.y);
  const x2 = toPixelX(edge.to.x);
  const y2 = toPixelY(edge.to.y);

  const strokeClassName = "text-muted-foreground";

  if (edge.kind === "partner") {
    const left = Math.min(x1, x2) + CARD_HALF_WIDTH;
    const right = Math.max(x1, x2) - CARD_HALF_WIDTH;
    return (
      <path
        className={strokeClassName}
        d={`M ${left} ${y1} L ${right} ${y1}`}
        fill="none"
        stroke="currentColor"
        strokeDasharray={edge.dashed ? "4 3" : undefined}
        strokeWidth={2}
      />
    );
  }

  const goingDown = y2 >= y1;
  const startY = goingDown ? y1 + CARD_HALF_HEIGHT : y1 - CARD_HALF_HEIGHT;
  const endY = goingDown ? y2 - CARD_HALF_HEIGHT : y2 + CARD_HALF_HEIGHT;
  const midY = (startY + endY) / 2;

  return (
    <path
      className={strokeClassName}
      d={`M ${x1} ${startY} L ${x1} ${midY} L ${x2} ${midY} L ${x2} ${endY}`}
      fill="none"
      stroke="currentColor"
      strokeDasharray={edge.dashed ? "4 3" : undefined}
      strokeWidth={2}
    />
  );
}

function FamilyTreeNodeCard({
  citizen,
  layoutNode,
  left,
  top,
}: {
  readonly citizen: Citizen;
  readonly layoutNode: FamilyTreeLayoutNode;
  readonly left: number;
  readonly top: number;
}): JSX.Element {
  const { node } = layoutNode;
  const style = { left, top, width: CARD_WIDTH };

  if (node.citizenId === null || node.name === null || node.status === null) {
    return (
      <div
        className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-md border border-dashed border-border bg-background px-3 py-2 text-center"
        style={style}
      >
        <span className="text-sm italic text-muted-foreground">Unknown</span>
      </div>
    );
  }

  const isCurrentCitizen = node.citizenId === citizen.id;
  const isDeceased = node.status === "dead";
  const isFormerPartner =
    node.direction === "partner" &&
    node.partnershipStatus !== null &&
    node.partnershipStatus !== "active";

  return (
    <div
      className={cn(
        "absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-start gap-1 rounded-md border bg-background px-3 py-2",
        isCurrentCitizen
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border",
        (isDeceased || isFormerPartner) && "opacity-70",
        isFormerPartner && "border-dashed",
      )}
      style={style}
    >
      <Link
        className="w-full truncate text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        params={{ citizenId: node.citizenId, worldId: citizen.worldId }}
        to="/worlds/$worldId/citizens/$citizenId"
      >
        {node.name}
      </Link>
      <StatusChip status={node.status} />
      {isFormerPartner ? (
        <span className="text-xs italic text-muted-foreground">
          {node.partnershipStatus === "widowed" ? "Widowed" : "Former partner"}
        </span>
      ) : null}
    </div>
  );
}
