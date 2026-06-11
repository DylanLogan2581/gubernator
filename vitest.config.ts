import { configDefaults, defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config";

// The end-turn integration test requires a running local Supabase stack and is
// driven by the Database CI job via `test:integration`. Keep it out of the
// default unit run, which has no Supabase available.
const runIntegration = process.env.VITEST_INTEGRATION === "true";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/test/setup.ts"],
      css: true,
      exclude: runIntegration
        ? configDefaults.exclude
        : [...configDefaults.exclude, "**/integration.test.ts"],
      coverage: {
        provider: "v8",
        reporter: ["text", "text-summary"],
        include: ["src/**/*.{ts,tsx}"],
        exclude: [
          "src/routeTree.gen.ts",
          "src/test/**",
          "src/**/*.test.{ts,tsx}",
        ],
        thresholds: {
          "src/shared/simulation/**": {
            statements: 90,
            branches: 85,
            functions: 90,
            lines: 90,
          },
        },
      },
    },
  }),
);
