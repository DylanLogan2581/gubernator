import fs from "node:fs";

import { expect, test as setup } from "@playwright/test";

import { ROLES } from "./roles";

import type { Role } from "./roles";

setup.describe.configure({ mode: "serial" });

for (const [role, creds] of Object.entries(ROLES) as [
  Role,
  (typeof ROLES)[Role],
][]) {
  setup(`authenticate ${role}`, async ({ page }) => {
    fs.mkdirSync("e2e/.auth", { recursive: true });
    await page.goto("/sign-in");
    await page.getByLabel(/email/i).fill(creds.email);
    await page.getByLabel(/password/i).fill(creds.password);
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).not.toHaveURL(/sign-in/, { timeout: 15_000 });
    await page.context().storageState({ path: `e2e/.auth/${role}.json` });
  });
}
