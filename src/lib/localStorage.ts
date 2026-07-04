// The only module allowed to touch window.localStorage directly (see
// eslint.config.ts's appRuntimeRestrictedSyntax) — everything else goes
// through these helpers so storage failures (private browsing, quota, SSR)
// are handled in one place instead of scattered try/catch blocks.
export function readLocalStorageItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocalStorageItem(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Best-effort persistence; callers treat a failed write the same as a
    // reload wiping the value.
  }
}

export function removeLocalStorageItem(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // See writeLocalStorageItem.
  }
}
