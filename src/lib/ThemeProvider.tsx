import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type JSX,
  type ReactNode,
} from "react";

import { writeLocalStorageItem } from "./localStorage";
import {
  applyThemeClass,
  readStoredTheme,
  THEME_STORAGE_KEY,
  ThemeContext,
  type Theme,
  type ThemeContextValue,
} from "./theme";

type ThemeProviderProps = {
  readonly children: ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps): JSX.Element {
  const [themeState, setThemeState] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    applyThemeClass(themeState);
  }, [themeState]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    writeLocalStorageItem(THEME_STORAGE_KEY, next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme: themeState, setTheme }),
    [themeState, setTheme],
  );

  return <ThemeContext value={value}>{children}</ThemeContext>;
}
