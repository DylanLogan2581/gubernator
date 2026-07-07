import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DIORAMA_SERIES, DIORAMA_TICK_INTERVAL_MS } from "../lib/dioramaSeries";

import { HomeDioramaSection } from "./HomeDioramaSection";

function mockMatchMedia(matches: boolean): void {
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches,
    media: "(prefers-reduced-motion: reduce)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
}

describe("HomeDioramaSection", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("renders the first frame of the deterministic series", () => {
    mockMatchMedia(false);
    render(<HomeDioramaSection />);

    expect(
      screen.getByText(String(DIORAMA_SERIES[0].population)),
    ).toBeInTheDocument();
  });

  it("advances to the next tick on a timer", () => {
    mockMatchMedia(false);
    render(<HomeDioramaSection />);

    act(() => {
      vi.advanceTimersByTime(DIORAMA_TICK_INTERVAL_MS);
    });

    expect(
      screen.getByText(String(DIORAMA_SERIES[1].population)),
    ).toBeInTheDocument();
  });

  it("stays on a static frame when the user prefers reduced motion", () => {
    mockMatchMedia(true);
    render(<HomeDioramaSection />);

    act(() => {
      vi.advanceTimersByTime(DIORAMA_TICK_INTERVAL_MS * 5);
    });

    expect(
      screen.getByText(String(DIORAMA_SERIES[0].population)),
    ).toBeInTheDocument();
  });

  it("shows the event badge only once the series reaches that tick", () => {
    mockMatchMedia(false);
    render(<HomeDioramaSection />);

    expect(screen.queryByText("Harvest festival")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(DIORAMA_TICK_INTERVAL_MS * 4);
    });

    expect(screen.getByText("Harvest festival")).toBeInTheDocument();
  });
});
