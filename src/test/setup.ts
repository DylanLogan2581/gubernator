import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// Provide Supabase config so components that build the client at import time
// do not throw SupabaseConfigurationError. CI has no .env, and tests must not
// depend on a developer's local environment.
vi.stubEnv("VITE_SUPABASE_URL", "http://127.0.0.1:54321");
vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }),
});

Object.defineProperty(window, "scrollTo", {
  configurable: true,
  writable: true,
  value: vi.fn(),
});

// jsdom has no ResizeObserver; Radix Tooltip's floating-ui positioning
// requires one on mount, or React unmounts the tree with an uncaught error.
class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

Object.defineProperty(window, "ResizeObserver", {
  configurable: true,
  writable: true,
  value: ResizeObserverStub,
});

// jsdom has no scrollIntoView; cmdk (Command) calls it when moving selection
// between items, which throws and aborts the test otherwise.
Element.prototype.scrollIntoView = vi.fn();
