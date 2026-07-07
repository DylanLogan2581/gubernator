import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { locationState, useLocationMock } = vi.hoisted(() => ({
  locationState: { pathname: "/notifications" },
  useLocationMock: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useLocation: useLocationMock,
}));

import { useRecentPageTracker } from "./UseRecentPageTracker";

describe("useRecentPageTracker", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useLocationMock.mockReset();
    useLocationMock.mockImplementation(() => locationState);
    document.body.innerHTML = "";
  });

  it("records the page when the route matches an entity page and an h1 is present", () => {
    locationState.pathname = "/worlds/world-1/nations/nation-1";
    document.body.innerHTML = "<h1>Ironmark</h1>";

    renderHook(() => {
      useRecentPageTracker();
    });

    expect(window.localStorage.getItem("gubernator:recent-pages")).toContain(
      "Ironmark",
    );
  });

  it("does not record when the route is not an entity page", () => {
    locationState.pathname = "/notifications";
    document.body.innerHTML = "<h1>Notifications</h1>";

    renderHook(() => {
      useRecentPageTracker();
    });

    expect(window.localStorage.getItem("gubernator:recent-pages")).toBeNull();
  });

  it("does not record when the page has no h1", () => {
    locationState.pathname = "/worlds/world-1/nations/nation-1";
    document.body.innerHTML = "";

    renderHook(() => {
      useRecentPageTracker();
    });

    expect(window.localStorage.getItem("gubernator:recent-pages")).toBeNull();
  });
});
