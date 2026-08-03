import { createContext, use } from "react";

import { readLocalStorageItem } from "./localStorage";

// "light"/"dark" force a theme by toggling the matching class on <html>;
// "system" removes both and lets the prefers-color-scheme fallback in
// src/index.css (@custom-variant dark) take over.
export type Theme = "light" | "dark" | "system";

export const THEME_STORAGE_KEY = "gubernator-theme";

export type ThemeContextValue = {
  readonly theme: Theme;
  readonly setTheme: (theme: Theme) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const context = use(ThemeContext);
  if (context === null) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

export function readStoredTheme(): Theme {
  const stored = readLocalStorageItem(THEME_STORAGE_KEY);
  return isTheme(stored) ? stored : "system";
}

// Mirrors the inline pre-paint script in index.html so the class stays in
// sync when the selection changes at runtime.
export function applyThemeClass(theme: Theme): void {
  const root = document.documentElement;
  root.classList.remove("dark", "light");
  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.add("light");
  }
}
