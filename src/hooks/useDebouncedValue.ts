import { useEffect, useState } from "react";

// Generic value debounce: returns `value` only after it has stopped
// changing for `delayMs`. Used to avoid re-filtering large in-memory lists
// on every keystroke (e.g. the command palette's entity search).
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [value, delayMs]);

  return debouncedValue;
}
