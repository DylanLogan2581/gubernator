import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebouncedValue } from "./useDebouncedValue";

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebouncedValue("a", 150));
    expect(result.current).toBe("a");
  });

  it("does not update before the delay elapses", () => {
    const { rerender, result } = renderHook(
      ({ value }) => useDebouncedValue(value, 150),
      { initialProps: { value: "a" } },
    );

    rerender({ value: "b" });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe("a");
  });

  it("updates once the delay elapses", () => {
    const { rerender, result } = renderHook(
      ({ value }) => useDebouncedValue(value, 150),
      { initialProps: { value: "a" } },
    );

    rerender({ value: "b" });
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current).toBe("b");
  });

  it("resets the timer on rapid successive changes", () => {
    const { rerender, result } = renderHook(
      ({ value }) => useDebouncedValue(value, 150),
      { initialProps: { value: "a" } },
    );

    rerender({ value: "b" });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ value: "c" });
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(50);
    });

    expect(result.current).toBe("c");
  });
});
