import type { FamilyTreeNode } from "../types/citizenTypes";

const PARTNER_COLUMN_OFFSET = 1;

export type FamilyTreeLayoutNode = {
  readonly node: FamilyTreeNode;
  readonly x: number;
  readonly y: number;
};

export type FamilyTreeLayoutEdge = {
  readonly dashed: boolean;
  readonly from: { readonly x: number; readonly y: number };
  readonly id: string;
  readonly kind: "lineage" | "partner";
  readonly to: { readonly x: number; readonly y: number };
};

export type FamilyTreeLayout = {
  readonly centerNodePath: string;
  readonly edges: readonly FamilyTreeLayoutEdge[];
  readonly maxColumn: number;
  readonly maxRow: number;
  readonly minColumn: number;
  readonly minRow: number;
  readonly nodes: readonly FamilyTreeLayoutNode[];
};

/**
 * Lays out a family tree in an abstract (column, row) grid: row is the
 * node's generation (negative = ancestors, positive = descendants); column
 * is derived from a classic subtree-centering pass over the node_path /
 * parent_path tree so every node sits centered above/below its children.
 * Partners of the center citizen are placed beside it on row 0.
 */
export function computeFamilyTreeLayout(
  nodes: readonly FamilyTreeNode[],
): FamilyTreeLayout {
  const byPath = new Map(nodes.map((node) => [node.nodePath, node]));
  const lineageNodes = nodes.filter((node) => node.direction !== "partner");
  const partnerNodes = nodes.filter((node) => node.direction === "partner");

  const childrenByParentPath = new Map<string, FamilyTreeNode[]>();
  for (const node of lineageNodes) {
    if (node.parentPath === null) {
      continue;
    }
    const siblings = childrenByParentPath.get(node.parentPath) ?? [];
    siblings.push(node);
    childrenByParentPath.set(node.parentPath, siblings);
  }
  for (const siblings of childrenByParentPath.values()) {
    siblings.sort((a, b) => {
      const branchRank = (node: FamilyTreeNode): number =>
        node.generation < 0 ? 0 : 1;
      const branchDiff = branchRank(a) - branchRank(b);
      if (branchDiff !== 0) {
        return branchDiff;
      }
      const nameDiff = (a.name ?? "").localeCompare(b.name ?? "");
      return nameDiff !== 0 ? nameDiff : a.nodePath.localeCompare(b.nodePath);
    });
  }

  const columnByPath = new Map<string, number>();
  function assignColumns(nodePath: string, leftEdge: number): number {
    const children = childrenByParentPath.get(nodePath) ?? [];
    if (children.length === 0) {
      columnByPath.set(nodePath, leftEdge + 0.5);
      return leftEdge + 1;
    }
    let cursor = leftEdge;
    for (const child of children) {
      cursor = assignColumns(child.nodePath, cursor);
    }
    const firstChildColumn = columnByPath.get(children[0].nodePath) ?? leftEdge;
    const lastChildColumn =
      columnByPath.get(children[children.length - 1].nodePath) ?? leftEdge;
    columnByPath.set(nodePath, (firstChildColumn + lastChildColumn) / 2);
    return cursor;
  }
  assignColumns("root", 0);

  const rootColumn = columnByPath.get("root") ?? 0;
  partnerNodes.forEach((partner, index) => {
    columnByPath.set(
      partner.nodePath,
      rootColumn + (index + PARTNER_COLUMN_OFFSET),
    );
  });

  const layoutNodes: FamilyTreeLayoutNode[] = nodes.map((node) => ({
    node,
    x: columnByPath.get(node.nodePath) ?? rootColumn,
    y: node.generation,
  }));

  const edges: FamilyTreeLayoutEdge[] = [];
  const drawnPairs = new Set<string>();
  function addEdge(
    from: FamilyTreeNode,
    to: FamilyTreeNode,
    kind: FamilyTreeLayoutEdge["kind"],
    dashed: boolean,
  ): void {
    const pairKey = `${from.nodePath}::${to.nodePath}`;
    if (drawnPairs.has(pairKey)) {
      return;
    }
    drawnPairs.add(pairKey);
    edges.push({
      dashed,
      from: {
        x: columnByPath.get(from.nodePath) ?? rootColumn,
        y: from.generation,
      },
      id: pairKey,
      kind,
      to: {
        x: columnByPath.get(to.nodePath) ?? rootColumn,
        y: to.generation,
      },
    });
  }

  for (const node of lineageNodes) {
    if (node.parentPath === null) {
      continue;
    }
    const structuralParent = byPath.get(node.parentPath);
    if (structuralParent === undefined) {
      continue;
    }
    addEdge(structuralParent, node, "lineage", false);
  }

  const byCitizenId = new Map<string, FamilyTreeNode>();
  for (const node of nodes) {
    if (node.citizenId !== null) {
      byCitizenId.set(node.citizenId, node);
    }
  }
  for (const node of lineageNodes) {
    if (node.citizenId === null) {
      continue;
    }
    for (const parentCitizenId of [
      node.parentACitizenId,
      node.parentBCitizenId,
    ]) {
      if (parentCitizenId === null) {
        continue;
      }
      const parentNode = byCitizenId.get(parentCitizenId);
      if (parentNode === undefined || parentNode.nodePath === node.parentPath) {
        continue;
      }
      addEdge(parentNode, node, "lineage", false);
    }
  }

  const root = byPath.get("root");
  if (root !== undefined) {
    for (const partner of partnerNodes) {
      addEdge(root, partner, "partner", partner.partnershipStatus !== "active");
    }
  }

  const columns = layoutNodes.map((n) => n.x);
  const rows = layoutNodes.map((n) => n.y);

  return {
    centerNodePath: "root",
    edges,
    maxColumn: columns.length > 0 ? Math.max(...columns) : 0,
    maxRow: rows.length > 0 ? Math.max(...rows) : 0,
    minColumn: columns.length > 0 ? Math.min(...columns) : 0,
    minRow: rows.length > 0 ? Math.min(...rows) : 0,
    nodes: layoutNodes,
  };
}
