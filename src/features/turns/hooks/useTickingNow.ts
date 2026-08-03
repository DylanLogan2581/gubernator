import { useEffect, useState } from "react";

const DEFAULT_TICK_MS = 1000;

// Cleanup-aware wall-clock ticker. Components must not reach for Date.now() or
// raw setInterval themselves (eslint no-restricted-syntax), and the elapsed
// timer on the turn pause overlay needs both.
export function useTickingNow(tickMs: number = DEFAULT_TICK_MS): number {
  // eslint-disable-next-line no-restricted-syntax
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      // eslint-disable-next-line no-restricted-syntax
      setNow(Date.now());
    }, tickMs);

    return () => {
      clearInterval(interval);
    };
  }, [tickMs]);

  return now;
}
