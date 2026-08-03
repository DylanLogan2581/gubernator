import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useTickingNow } from "./useTickingNow";

describe("useTickingNow", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts at the current time and advances on each tick", () => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse("2026-08-03T12:00:00.000Z"));

    const { result } = renderHook(() => useTickingNow());

    expect(result.current).toBe(Date.parse("2026-08-03T12:00:00.000Z"));

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current).toBe(Date.parse("2026-08-03T12:00:02.000Z"));
  });

  it("stops ticking once unmounted", () => {
    vi.useFakeTimers();
    const clearInterval = vi.spyOn(globalThis, "clearInterval");

    const { unmount } = renderHook(() => useTickingNow());
    unmount();

    expect(clearInterval).toHaveBeenCalled();
  });
});
