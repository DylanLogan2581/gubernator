import { act, render, renderHook } from "@testing-library/react";
import { type ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { THEME_STORAGE_KEY, useTheme } from "./theme";
import { ThemeProvider } from "./ThemeProvider";

function wrapper({ children }: { children: ReactNode }): React.JSX.Element {
  return <ThemeProvider>{children}</ThemeProvider>;
}

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.classList.remove("dark", "light");
});

describe("ThemeProvider", () => {
  it("defaults to system and applies no class", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("system");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });

  it("adds the dark class and persists when set to dark", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => {
      result.current.setTheme("dark");
    });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.documentElement.classList.contains("light")).toBe(false);
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("adds the light class and clears dark when switching", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => {
      result.current.setTheme("dark");
    });
    act(() => {
      result.current.setTheme("light");
    });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("removes both classes when returning to system", () => {
    const { result } = renderHook(() => useTheme(), { wrapper });
    act(() => {
      result.current.setTheme("dark");
    });
    act(() => {
      result.current.setTheme("system");
    });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });

  it("reads the persisted theme on mount", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    const { result } = renderHook(() => useTheme(), { wrapper });
    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("throws when useTheme is used outside a provider", () => {
    expect(() => render(<UsesThemeOutsideProvider />)).toThrow(
      /useTheme must be used within a ThemeProvider/,
    );
  });
});

function UsesThemeOutsideProvider(): React.JSX.Element {
  useTheme();
  return <div />;
}
