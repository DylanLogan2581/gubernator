// fantasynamegenerators.com sits behind a Cloudflare bot-management layer:
// a JS challenge on first visit (a plain fetch() can never pass it — no JS
// execution) and an escalating per-session challenge on *repeat* page
// navigations from the same browser context, which never resolves in
// headless automation. A fresh BrowserContext per page navigation avoids the
// escalation entirely (each request looks like a first-time visitor); the
// site's own script assets (scripts/*.js) aren't subject to the same
// escalation and can be fetched freely once a context's challenge clears.
import { type Browser, type Page, chromium } from "@playwright/test";

import type { CategoryLinks } from "./types.ts";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";
const CHALLENGE_WAIT_MS = 5000;
const KNOWN_UTILITY_SCRIPTS = new Set([
  "savingNames.js",
  "banner.js",
  "randomGen.js",
]);

export async function launchBrowser(): Promise<Browser> {
  return chromium.launch({
    headless: true,
    args: ["--disable-blink-features=AutomationControlled"],
  });
}

async function withFreshPage<T>(
  browser: Browser,
  run: (page: Page) => Promise<T>,
): Promise<T> {
  const context = await browser.newContext({
    userAgent: USER_AGENT,
    viewport: { width: 1280, height: 800 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  try {
    const page = await context.newPage();
    return await run(page);
  } finally {
    await context.close();
  }
}

export async function crawlCategoryLinks(
  browser: Browser,
): Promise<CategoryLinks[]> {
  return withFreshPage(browser, async (page) => {
    await page.goto("https://fantasynamegenerators.com/dwarf-names.php", {
      waitUntil: "domcontentloaded",
      timeout: 45000,
    });
    await page.waitForTimeout(CHALLENGE_WAIT_MS);
    return page.evaluate(() => {
      const nav = document.querySelector("ul.navmenu");
      if (nav === null) return [];
      return Array.from(nav.children).map((li) => {
        const label = Array.from(li.childNodes).find(
          (node) =>
            node.nodeType === 3 && (node.textContent ?? "").trim().length > 0,
        );
        const items = Array.from(li.querySelectorAll("a[href]")).map((a) => ({
          href: a.getAttribute("href") ?? "",
          text: (a.textContent ?? "").trim(),
        }));
        return {
          category: label !== undefined ? (label.textContent ?? "").trim() : "",
          items,
        };
      });
    });
  });
}

export async function fetchGeneratorScript(
  browser: Browser,
  href: string,
): Promise<{ scriptUrl: string; source: string } | { error: string }> {
  return withFreshPage(browser, async (page) => {
    const pageUrl = `https://fantasynamegenerators.com/${href}`;
    try {
      await page.goto(pageUrl, {
        waitUntil: "domcontentloaded",
        timeout: 45000,
      });
    } catch (err) {
      return {
        error: `page navigation failed: ${String(err instanceof Error ? err.message : err)}`,
      };
    }
    await page.waitForTimeout(CHALLENGE_WAIT_MS);

    const scripts = await page.evaluate(() =>
      Array.from(document.querySelectorAll("script[src]"))
        .map((el) => el.getAttribute("src") ?? "")
        .filter((src) => src.includes("scripts/")),
    );
    const scriptUrl = scripts.find((src) => {
      const name = src.split("/").pop()?.split("?")[0];
      return name !== undefined && !KNOWN_UTILITY_SCRIPTS.has(name);
    });
    if (scriptUrl === undefined)
      return { error: "no generator script tag found on page" };

    const script = await page.evaluate(async (url) => {
      const res = await fetch(url);
      if (!res.ok) return { ok: false as const, status: res.status };
      return { ok: true as const, text: await res.text() };
    }, scriptUrl);
    if (!script.ok)
      return { error: `script fetch failed with status ${script.status}` };

    return { scriptUrl, source: script.text };
  });
}
