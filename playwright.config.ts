import { defineConfig, devices } from "@playwright/test";

import { ROLES } from "./e2e/roles";

import type { Role } from "./e2e/roles";

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:5173";

const roleNames = Object.keys(ROLES) as Role[];

const screenshotProjects = roleNames.flatMap((role) => [
  {
    name: `shots-${role}`,
    testMatch: /screenshots\/.*\.spec\.ts/,
    dependencies: ["setup"],
    use: {
      ...devices["Desktop Chrome"],
      viewport: { width: 1440, height: 900 },
      storageState: `e2e/.auth/${role}.json`,
    },
  },
  {
    name: `shots-${role}-mobile`,
    testMatch: /screenshots\/.*\.spec\.ts/,
    dependencies: ["setup"],
    use: {
      ...devices["Pixel 7"],
      storageState: `e2e/.auth/${role}.json`,
    },
  },
]);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  timeout: 600_000,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    ...screenshotProjects,
    {
      name: "e2e",
      testMatch: /tests\/.*\.spec\.ts/,
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        storageState: "e2e/.auth/player.json",
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
