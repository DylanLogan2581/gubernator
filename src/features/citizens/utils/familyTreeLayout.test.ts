import { describe, expect, it } from "vitest";

import { computeFamilyTreeLayout } from "./familyTreeLayout";

import type { FamilyTreeNode } from "../types/citizenTypes";

function node(overrides: Partial<FamilyTreeNode>): FamilyTreeNode {
  return {
    citizenId: null,
    direction: "unknown",
    generation: 0,
    name: null,
    nodePath: "root",
    parentACitizenId: null,
    parentBCitizenId: null,
    parentPath: null,
    partnershipStatus: null,
    status: null,
    ...overrides,
  };
}

describe("computeFamilyTreeLayout", () => {
  it("places the center at root and children on the next row", () => {
    const nodes: FamilyTreeNode[] = [
      node({
        citizenId: "center",
        direction: "self",
        generation: 0,
        name: "Center",
        nodePath: "root",
        status: "alive",
      }),
      node({
        citizenId: "child-a",
        direction: "descendant",
        generation: 1,
        name: "Child A",
        nodePath: "root.child-a",
        parentACitizenId: "center",
        parentPath: "root",
        status: "alive",
      }),
      node({
        citizenId: "child-b",
        direction: "descendant",
        generation: 1,
        name: "Child B",
        nodePath: "root.child-b",
        parentACitizenId: "center",
        parentPath: "root",
        status: "alive",
      }),
    ];

    const layout = computeFamilyTreeLayout(nodes);

    const rootLayout = layout.nodes.find((n) => n.node.nodePath === "root");
    const childALayout = layout.nodes.find(
      (n) => n.node.nodePath === "root.child-a",
    );
    const childBLayout = layout.nodes.find(
      (n) => n.node.nodePath === "root.child-b",
    );

    expect(rootLayout?.y).toBe(0);
    expect(childALayout?.y).toBe(1);
    expect(childBLayout?.y).toBe(1);
    // Root is centered above its two children.
    expect(rootLayout?.x).toBe(
      ((childALayout?.x ?? 0) + (childBLayout?.x ?? 0)) / 2,
    );
    expect(childALayout?.x).not.toBe(childBLayout?.x);
  });

  it("draws a structural edge from every non-root lineage node to its parent_path target", () => {
    const nodes: FamilyTreeNode[] = [
      node({ citizenId: "center", direction: "self", nodePath: "root" }),
      node({
        citizenId: null,
        direction: "unknown",
        generation: -1,
        name: null,
        nodePath: "root.AB",
        parentPath: "root",
        status: null,
      }),
    ];

    const layout = computeFamilyTreeLayout(nodes);

    expect(layout.edges).toHaveLength(1);
    expect(layout.edges[0]).toMatchObject({
      dashed: false,
      from: { y: 0 },
      kind: "lineage",
      to: { y: -1 },
    });
  });

  it("adds a second edge for a descendant's co-parent without duplicating the primary edge", () => {
    const nodes: FamilyTreeNode[] = [
      node({ citizenId: "center", direction: "self", nodePath: "root" }),
      node({
        citizenId: "partner",
        direction: "partner",
        generation: 0,
        name: "Partner",
        nodePath: "partner:partner",
        parentPath: "root",
        partnershipStatus: "active",
        status: "alive",
      }),
      node({
        citizenId: "child",
        direction: "descendant",
        generation: 1,
        name: "Child",
        nodePath: "root.child",
        parentACitizenId: "center",
        parentBCitizenId: "partner",
        parentPath: "root",
        status: "alive",
      }),
    ];

    const layout = computeFamilyTreeLayout(nodes);

    const childEdges = layout.edges.filter((e) => e.to.y === 1);
    // One edge from root (the walk parent) and one cross-link from the
    // partner node, both landing on the child.
    expect(childEdges).toHaveLength(2);
  });

  it("marks a partner edge dashed when the partnership is not active", () => {
    const nodes: FamilyTreeNode[] = [
      node({ citizenId: "center", direction: "self", nodePath: "root" }),
      node({
        citizenId: "ex-partner",
        direction: "partner",
        generation: 0,
        name: "Ex Partner",
        nodePath: "partner:ex-partner",
        parentPath: "root",
        partnershipStatus: "dissolved",
        status: "alive",
      }),
    ];

    const layout = computeFamilyTreeLayout(nodes);

    const partnerEdge = layout.edges.find((e) => e.kind === "partner");
    expect(partnerEdge?.dashed).toBe(true);
  });
});
