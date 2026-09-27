import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { getEnv } from "../config/env";
import { getPaths } from "../config/paths";

export interface BrowserSession {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

export async function launchSession(options: { storageState?: string; headless?: boolean } = {}): Promise<BrowserSession> {
  const env = getEnv();
  const browser = await chromium.launch({
    headless: options.headless ?? env.HEADLESS,
  });
  const context = await browser.newContext({
    storageState: options.storageState,
    viewport: { width: 1366, height: 768 },
  });
  const page = await context.newPage();
  return { browser, context, page };
}

export async function closeSession(session: BrowserSession): Promise<void> {
  await session.context.close();
  await session.browser.close();
}

export async function captureFailureScreenshot(page: Page, label: string): Promise<string> {
  const fileName = `${Date.now()}-${label.replace(/[^a-z0-9-]/gi, "-")}.png`;
  const target = path.join(getPaths().screenshotsDir, fileName);
  await mkdir(path.dirname(target), { recursive: true });
  await page.screenshot({ path: target, fullPage: true });
  return target;
}
