import { mkdir } from "node:fs/promises";
import { chromium, type Page } from "playwright";

const baseUrl = process.env.BASE_URL ?? "http://localhost:3001";
const outputDir = "screenshots";

async function settle(page: Page) {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(800);
}

async function capture(page: Page, name: string) {
  await settle(page);
  await page.screenshot({ path: `${outputDir}/${name}.png` });
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  const browser = await chromium.launch({ channel: "chrome" });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1024 },
    colorScheme: "dark",
    deviceScaleFactor: 1,
  });

  await context.addInitScript(() => {
    localStorage.setItem("boxbox-theme", "dark");
  });

  const page = await context.newPage();
  page.setDefaultTimeout(30_000);

  try {
    await page.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
    await capture(page, "home");

  await page.goto(`${baseUrl}/lab/replay?year=2024&session=9590`);
  await page.getByText("RUNNING ORDER", { exact: true }).waitFor({
    state: "visible",
    timeout: 120_000,
  });
  await capture(page, "replay");

  await page.goto(`${baseUrl}/lab/ghost?year=2024&session=9590&a=1&b=4`);
  await page.getByText("TELEMETRY — DISTANCE ALIGNED", { exact: true }).waitFor({
    state: "visible",
    timeout: 120_000,
  });
  await capture(page, "ghost");

  await page.goto(`${baseUrl}/lab/h2h`);
  await page.getByText("VERSUS", { exact: true }).waitFor({
    state: "visible",
    timeout: 90_000,
  });
  await page.getByText("ROUND LOG · RAW COMPARABLE RESULTS", { exact: true }).waitFor();
  await capture(page, "h2h");

  await page.goto(
    `${baseUrl}/studio/poster?year=2025&track=monza&accent=ff3b30&bg=080c0d&ink=edf3f3&line=7&title=MONZA&subtitle=Italian%20Grand%20Prix`,
  );
  await page.locator("section svg").waitFor({ state: "visible", timeout: 30_000 });
  await page.locator("section svg").getByText("MONZA", { exact: true }).waitFor();
  await capture(page, "poster");

  await page.goto(`${baseUrl}/studio/scenarios`);
  await page.getByText("FINAL STANDINGS", { exact: true }).waitFor({
    state: "visible",
    timeout: 90_000,
  });
  await capture(page, "scenarios");

    await page.goto(
      `${baseUrl}/studio/recap?year=2021&driver=max-verstappen&rival=lewis-hamilton&bg=080c0d&ink=edf3f3&accent=ff3b30`,
    );
    const recap = page.locator(".recap-host svg");
    await recap.waitFor({ state: "visible", timeout: 90_000 });
    await recap.getByText("VERSTAPPEN", { exact: true }).waitFor();
    await capture(page, "recap");
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
