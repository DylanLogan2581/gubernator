import fs from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { test } from "@playwright/test";

const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;
const MAX_PAGES = 80;
const SEED_PATHS = ["/", "/worlds", "/notifications", "/superadmin"];
const MAX_BODY_CHARS = 500;

function truncateBody(body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return flat.length > MAX_BODY_CHARS
    ? `${flat.slice(0, MAX_BODY_CHARS)}…`
    : flat;
}

function routePattern(pathname: string): string {
  return pathname.replace(UUID_RE, ":id").replace(/\/\d+(?=\/|$)/g, "/:num");
}

function slugFor(pathname: string): string {
  const pattern = routePattern(pathname);
  if (pattern === "/") return "home";
  return pattern
    .replace(/^\//, "")
    .replaceAll("/", "__")
    .replaceAll(":", "")
    .replace(/[^a-zA-Z0-9_-]/g, "-");
}

type A11yViolation = {
  id: string;
  impact: string | null | undefined;
  description: string;
  nodes: number;
};

test("crawl all views and screenshot", async ({ page }, testInfo) => {
  // project names: shots-<role> or shots-<role>-mobile
  const variant = testInfo.project.name.replace(/^shots-/, "");
  const isMobileVariant = variant.endsWith("-mobile");
  const outDir = path.join("screenshots", "auto", variant);
  fs.mkdirSync(outDir, { recursive: true });

  const consoleErrors: Record<string, string[]> = {};
  const push = (key: string, message: string): void => {
    (consoleErrors[key] ??= []).push(message);
  };
  const record = (message: string): void => {
    push(routePattern(new URL(page.url()).pathname), message);
  };
  page.on("console", (msg) => {
    if (msg.type() === "error") record(msg.text());
  });
  page.on("pageerror", (err) => {
    record(`pageerror: ${err.message}`);
  });
  page.on("response", (response) => {
    if (response.status() < 400) return;
    // capture key now: page may navigate before the body promise settles
    const key = routePattern(new URL(page.url()).pathname);
    void response
      .text()
      .then((body) => {
        push(
          key,
          `HTTP ${response.status()} ${response.url()} ${truncateBody(body)}`,
        );
      })
      .catch(() => {
        push(key, `HTTP ${response.status()} ${response.url()}`);
      });
  });

  const queue = [...SEED_PATHS];
  const visitedPatterns = new Set<string>();
  const captured: { pattern: string; url: string; file: string }[] = [];
  const a11y: Record<string, A11yViolation[]> = {};
  const writeReport = (): void => {
    fs.writeFileSync(
      path.join(outDir, "report.json"),
      JSON.stringify({ variant, captured, consoleErrors, a11y }, null, 2),
    );
  };

  while (queue.length > 0 && captured.length < MAX_PAGES) {
    const target = queue.shift();
    if (target === undefined) break;
    const pattern = routePattern(target);
    if (visitedPatterns.has(pattern)) continue;
    visitedPatterns.add(pattern);

    await page.goto(target, { waitUntil: "domcontentloaded" });
    await page
      .waitForLoadState("networkidle", { timeout: 15_000 })
      .catch(() => undefined);
    // let charts/animations settle
    await page.waitForTimeout(400);

    const finalPath = new URL(page.url()).pathname;
    if (finalPath.startsWith("/sign-in")) {
      // role has no access; record and move on
      captured.push({ pattern, url: target, file: "(redirected-to-sign-in)" });
      continue;
    }

    const file = `${slugFor(finalPath)}.png`;
    await page.screenshot({
      path: path.join(outDir, file),
      fullPage: true,
      animations: "disabled",
    });
    captured.push({ pattern: routePattern(finalPath), url: target, file });

    const axe = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    if (axe.violations.length > 0) {
      a11y[routePattern(finalPath)] = axe.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        description: v.description,
        nodes: v.nodes.length,
      }));
    }

    if (isMobileVariant) {
      // nav links live in a Sheet that's unmounted until the hamburger opens
      const trigger = page.locator('[data-slot="sidebar-trigger"]');
      if ((await trigger.count()) > 0) {
        await trigger.first().click();
        await page
          .getByRole("dialog")
          .waitFor({ state: "visible", timeout: 2_000 })
          .catch(() => undefined);
      }
    }

    const hrefs = await page.$$eval("a[href]", (anchors) =>
      anchors.map((a) => a.getAttribute("href") ?? ""),
    );
    for (const href of hrefs) {
      if (!href.startsWith("/") || href.startsWith("//")) continue;
      const clean = href.split("#")[0].split("?")[0];
      if (clean === "") continue;
      if (!visitedPatterns.has(routePattern(clean))) queue.push(clean);
    }
    writeReport();
  }
});
