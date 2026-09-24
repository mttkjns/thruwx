/**
 * README screenshots — regenerates docs/screenshots/*.png from the production
 * build, using a fixed demo plan so the images are reproducible.
 *
 *   npm run screenshots
 *
 * One-time prerequisite: Playwright's Chromium and its system libraries
 *   npx playwright install --only-shell chromium
 *   sudo npx playwright install-deps chromium
 *
 * The map shot fetches live OpenStreetMap tiles, so this needs network.
 */
import { execSync, spawn } from "node:child_process";
import { mkdirSync, statSync } from "node:fs";
import path from "node:path";
import { chromium, type Locator, type Page } from "playwright";
import { defaultStartDate, PLAN_SCHEMA_VERSION } from "../src/domain/plan";
import type { TripPlan } from "../src/domain/types";

const ROOT = path.join(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "docs/screenshots");
const PORT = 4179;
const URL = `http://localhost:${PORT}/`;

/** Full NOBO thru-hike with a little gear, so every view has content. */
const DEMO_PLAN: TripPlan = {
  schemaVersion: PLAN_SCHEMA_VERSION,
  startDate: defaultStartDate(), // upcoming Mar 1: never "in the past"
  direction: "NOBO",
  paceMilesPerDay: 14, // non-default, so the welcome banner stays hidden
  gear: [
    { id: "quilt-20", name: "20°F quilt", category: "sleep", comfortThresholdF: 40 },
    { id: "puffy", name: "Down puffy", category: "insulation", comfortThresholdF: 35 },
    { id: "microspikes", name: "Microspikes", category: "footwear", comfortThresholdF: 25 },
    { id: "rain-jacket", name: "Rain jacket", category: "layers" },
  ],
  swaps: [
    { id: "swap-damascus", waypointId: "damascus-va", addItemIds: [], removeItemIds: ["microspikes"] },
  ],
};

async function startPreview(): Promise<() => void> {
  const proc = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], {
    cwd: ROOT,
    stdio: "ignore",
  });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(URL)).ok) return () => proc.kill();
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  proc.kill();
  throw new Error(`vite preview did not start on port ${PORT}`);
}

async function waitForClimate(page: Page): Promise<void> {
  await page.getByText("Load climate data").waitFor({ state: "detached" });
  await page.getByText("Awaiting climate data").first().waitFor({ state: "detached" });
}

/** Wait until every visible map tile has loaded and the count stops changing. */
async function waitForTiles(page: Page): Promise<void> {
  await page.locator(".leaflet-tile-loaded").first().waitFor();
  let last = -1;
  for (let i = 0; i < 40; i++) {
    const loaded = await page.locator(".leaflet-tile-loaded").count();
    const pending = await page.locator(".leaflet-tile:not(.leaflet-tile-loaded)").count();
    if (pending === 0 && loaded === last) return;
    last = loaded;
    await page.waitForTimeout(250);
  }
  console.warn("  WARN map tiles still loading; capturing anyway");
}

/**
 * Screenshot the viewport's width, from the top of the page down to `until`'s
 * bottom edge (plus a margin), so the image ends between cards rather than
 * slicing through one. Without `until`, the current viewport.
 */
async function shot(page: Page, file: string, until?: Locator): Promise<void> {
  const out = path.join(OUT_DIR, file);
  if (until) {
    const box = await until.boundingBox();
    if (!box) throw new Error(`${file}: crop target not visible`);
    const width = page.viewportSize()!.width;
    await page.screenshot({ path: out, fullPage: true, clip: { x: 0, y: 0, width, height: box.y + box.height + 16 } });
  } else {
    await page.screenshot({ path: out });
  }
  console.log(`  ${file.padEnd(12)} ${(statSync(out).size / 1024).toFixed(0)} KB`);
}

mkdirSync(OUT_DIR, { recursive: true });
console.log("Building…");
execSync("npx vite build", { cwd: ROOT, stdio: "ignore" });
const stopPreview = await startPreview();
const browser = await chromium.launch();

try {
  const seed = (plan: TripPlan) => {
    localStorage.setItem("thruwx-plan", JSON.stringify({ state: { plan }, version: plan.schemaVersion }));
    localStorage.setItem("thruwx-climate-autoload", "1");
  };

  console.log(`Capturing to ${path.relative(ROOT, OUT_DIR)}/ (start ${DEMO_PLAN.startDate})`);

  // Desktop: one page, three tabs, each at its own viewport.
  const desktop = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
  await desktop.addInitScript(seed, DEMO_PLAN);
  await desktop.goto(URL);
  await waitForClimate(desktop);
  // Trip setup plus the first five waypoint rows (with their leg profiles).
  await shot(desktop, "timeline.png", desktop.locator("ol > li").nth(4));

  await desktop.setViewportSize({ width: 1440, height: 900 });
  await desktop.getByRole("button", { name: "map", exact: true }).click();
  await waitForTiles(desktop);
  // The chart card is taller than the map; end the image below it.
  await shot(desktop, "map.png", desktop.locator("section", { hasText: "Conditions along the hike" }));

  await desktop.setViewportSize({ width: 1280, height: 1100 });
  await desktop.getByRole("button", { name: "gear", exact: true }).click();
  await desktop.waitForTimeout(300);
  await shot(desktop, "gear.png");

  // Phone: touch device, so the map-lock button etc. behave as on mobile.
  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await phone.addInitScript(seed, DEMO_PLAN);
  await phone.goto(URL);
  await waitForClimate(phone);
  // Skip past the trip-setup form to the waypoint rows.
  const firstRow = await phone.locator("ol > li").first().boundingBox();
  await phone.evaluate(`window.scrollTo(0, ${Math.round(firstRow!.y - 16)})`);
  await phone.waitForTimeout(200);
  await shot(phone, "mobile.png");
} finally {
  await browser.close();
  stopPreview();
}
