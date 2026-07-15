import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NationDiscoveryGrid } from "./NationDiscoveryGrid";
import { buildDiscoveryPairMap } from "./NationDiscoveryUtils";

import type { Nation, NationDiscoveryPair } from "../../types/nationTypes";

vi.mock("../../queries/nationImageQueries", () => ({
  useNationImageSignedUrl: () => ({ isLoading: false, url: null }),
}));

function makeNation(id: string, name: string): Nation {
  return {
    capitalSettlementId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    description: null,
    flagPath: null,
    foundedTurnNumber: null,
    governmentType: "monarchy",
    id,
    name,
    namesetId: null,
    primaryCultureId: null,
  } as Nation;
}

const nationA = makeNation("nation-1", "Aldoria");
const nationB = makeNation("nation-2", "Bruma");
const nationC = makeNation("nation-3", "Corvia");

describe("NationDiscoveryGrid", () => {
  it("toggles a pair via click and via keyboard space", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <NationDiscoveryGrid
        bulkPendingNationId={null}
        canEdit
        rows={[nationA, nationB]}
        columns={[nationA, nationB]}
        pairsByKey={buildDiscoveryPairMap([])}
        pendingKey={null}
        onClearAll={vi.fn()}
        onDiscoverAll={vi.fn()}
        onToggle={onToggle}
      />,
    );

    const cell = screen.getByRole("button", {
      name: "Aldoria ↔ Bruma: not discovered",
    });
    await user.click(cell);
    expect(onToggle).toHaveBeenCalledWith(nationA, nationB, true);

    cell.focus();
    await user.keyboard(" ");
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it("marks both mirrored cells of a discovered pair as pressed and keeps them in sync", () => {
    const pair: NationDiscoveryPair = {
      createdByUserId: null,
      metAtTurnNumber: 4,
      nationAId: nationA.id,
      nationBId: nationB.id,
    };

    render(
      <NationDiscoveryGrid
        bulkPendingNationId={null}
        canEdit
        rows={[nationA, nationB]}
        columns={[nationA, nationB]}
        pairsByKey={buildDiscoveryPairMap([pair])}
        pendingKey={null}
        onClearAll={vi.fn()}
        onDiscoverAll={vi.fn()}
        onToggle={vi.fn()}
      />,
    );

    // Both triangles are interactive and mirror the same underlying pair.
    expect(
      screen.getByRole("button", { name: "Aldoria ↔ Bruma: discovered" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "Bruma ↔ Aldoria: discovered" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("toggling the mirrored (lower-triangle) cell calls onToggle with the same pair", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <NationDiscoveryGrid
        bulkPendingNationId={null}
        canEdit
        rows={[nationA, nationB]}
        columns={[nationA, nationB]}
        pairsByKey={buildDiscoveryPairMap([])}
        pendingKey={null}
        onClearAll={vi.fn()}
        onDiscoverAll={vi.fn()}
        onToggle={onToggle}
      />,
    );

    const mirroredCell = screen.getByRole("button", {
      name: "Bruma ↔ Aldoria: not discovered",
    });
    await user.click(mirroredCell);
    expect(onToggle).toHaveBeenCalledWith(nationB, nationA, true);
  });

  it("does not render a control for the diagonal (self) cell", () => {
    render(
      <NationDiscoveryGrid
        bulkPendingNationId={null}
        canEdit
        rows={[nationA, nationB]}
        columns={[nationA, nationB]}
        pairsByKey={buildDiscoveryPairMap([])}
        pendingKey={null}
        onClearAll={vi.fn()}
        onDiscoverAll={vi.fn()}
        onToggle={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: /Aldoria ↔ Aldoria/ }),
    ).not.toBeInTheDocument();
  });

  it("calls onDiscoverAll and onClearAll from a row's actions menu", async () => {
    const user = userEvent.setup();
    const onDiscoverAll = vi.fn();
    const onClearAll = vi.fn();

    render(
      <NationDiscoveryGrid
        bulkPendingNationId={null}
        canEdit
        rows={[nationA, nationB, nationC]}
        columns={[nationA, nationB, nationC]}
        pairsByKey={buildDiscoveryPairMap([])}
        pendingKey={null}
        onClearAll={onClearAll}
        onDiscoverAll={onDiscoverAll}
        onToggle={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", { name: "Actions for Aldoria" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Discover all" }));
    expect(onDiscoverAll).toHaveBeenCalledWith(nationA);

    await user.click(
      screen.getByRole("button", { name: "Actions for Aldoria" }),
    );
    await user.click(screen.getByRole("menuitem", { name: "Clear all" }));
    expect(onClearAll).toHaveBeenCalledWith(nationA);
  });

  it("disables the actions menu for the row currently processing", () => {
    render(
      <NationDiscoveryGrid
        bulkPendingNationId={nationA.id}
        canEdit
        rows={[nationA, nationB]}
        columns={[nationA, nationB]}
        pairsByKey={buildDiscoveryPairMap([])}
        pendingKey={null}
        onClearAll={vi.fn()}
        onDiscoverAll={vi.fn()}
        onToggle={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", { name: "Actions for Aldoria" }),
    ).toBeDisabled();
  });

  it("hides the row actions menu when the viewer cannot edit", () => {
    render(
      <NationDiscoveryGrid
        bulkPendingNationId={null}
        canEdit={false}
        rows={[nationA, nationB]}
        columns={[nationA, nationB]}
        pairsByKey={buildDiscoveryPairMap([])}
        pendingKey={null}
        onClearAll={vi.fn()}
        onDiscoverAll={vi.fn()}
        onToggle={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", { name: "Actions for Aldoria" }),
    ).not.toBeInTheDocument();
  });

  it("shows each column's nation name as a hover title on the flag header", () => {
    render(
      <NationDiscoveryGrid
        bulkPendingNationId={null}
        canEdit
        rows={[nationA, nationB]}
        columns={[nationA, nationB]}
        pairsByKey={buildDiscoveryPairMap([])}
        pendingKey={null}
        onClearAll={vi.fn()}
        onDiscoverAll={vi.fn()}
        onToggle={vi.fn()}
      />,
    );

    expect(screen.getByRole("columnheader", { name: "Bruma" })).toHaveAttribute(
      "title",
      "Bruma",
    );
  });
});
