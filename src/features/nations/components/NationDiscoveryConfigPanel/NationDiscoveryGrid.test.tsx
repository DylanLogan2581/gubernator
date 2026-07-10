import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NationDiscoveryGrid } from "./NationDiscoveryGrid";
import { buildDiscoveryPairMap } from "./NationDiscoveryUtils";

import type { Nation, NationDiscoveryPair } from "../../types/nationTypes";

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
        nations={[nationA, nationB]}
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

  it("marks a discovered pair as pressed and mutes the mirrored lower-triangle cell", () => {
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
        nations={[nationA, nationB]}
        pairsByKey={buildDiscoveryPairMap([pair])}
        pendingKey={null}
        onClearAll={vi.fn()}
        onDiscoverAll={vi.fn()}
        onToggle={vi.fn()}
      />,
    );

    const cell = screen.getByRole("button", {
      name: "Aldoria ↔ Bruma: discovered",
    });
    expect(cell).toHaveAttribute("aria-pressed", "true");

    // Only one interactive control exists per unordered pair; the mirrored
    // lower-triangle cell is a muted, non-interactive placeholder.
    expect(
      screen.queryByRole("button", { name: "Bruma ↔ Aldoria: discovered" }),
    ).not.toBeInTheDocument();
  });

  it("calls onDiscoverAll and onClearAll for a row's bulk actions", async () => {
    const user = userEvent.setup();
    const onDiscoverAll = vi.fn();
    const onClearAll = vi.fn();

    render(
      <NationDiscoveryGrid
        bulkPendingNationId={null}
        canEdit
        nations={[nationA, nationB, nationC]}
        pairsByKey={buildDiscoveryPairMap([])}
        pendingKey={null}
        onClearAll={onClearAll}
        onDiscoverAll={onDiscoverAll}
        onToggle={vi.fn()}
      />,
    );

    await user.click(
      screen.getByRole("button", {
        name: "Mark Aldoria as met with all nations",
      }),
    );
    expect(onDiscoverAll).toHaveBeenCalledWith(nationA);

    await user.click(
      screen.getByRole("button", {
        name: "Mark Aldoria as unmet with all nations",
      }),
    );
    expect(onClearAll).toHaveBeenCalledWith(nationA);
  });

  it("disables bulk actions for the row currently processing", () => {
    render(
      <NationDiscoveryGrid
        bulkPendingNationId={nationA.id}
        canEdit
        nations={[nationA, nationB]}
        pairsByKey={buildDiscoveryPairMap([])}
        pendingKey={null}
        onClearAll={vi.fn()}
        onDiscoverAll={vi.fn()}
        onToggle={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("button", {
        name: "Mark Aldoria as met with all nations",
      }),
    ).toBeDisabled();
  });

  it("hides bulk row actions when the viewer cannot edit", () => {
    render(
      <NationDiscoveryGrid
        bulkPendingNationId={null}
        canEdit={false}
        nations={[nationA, nationB]}
        pairsByKey={buildDiscoveryPairMap([])}
        pendingKey={null}
        onClearAll={vi.fn()}
        onDiscoverAll={vi.fn()}
        onToggle={vi.fn()}
      />,
    );

    expect(
      screen.queryByRole("button", {
        name: "Mark Aldoria as met with all nations",
      }),
    ).not.toBeInTheDocument();
  });
});
