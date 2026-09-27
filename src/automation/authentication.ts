import { access } from "node:fs/promises";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { storageStatePath } from "../config/paths";
import { logger } from "../utils/logger";
import { closeSession, launchSession, type BrowserSession } from "./browser";

export function portalFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("indeed")) return "indeed";
    if (host.includes("naukri")) return "naukri";
    if (host.includes("internshala")) return "internshala";
    return host.split(".")[0] || "generic";
  } catch {
    return "generic";
  }
}

export async function storageStateExists(portal: string): Promise<boolean> {
  try {
    await access(storageStatePath(portal));
    return true;
  } catch {
    return false;
  }
}

export async function openAuthenticatedSession(url: string, options: { headless?: boolean } = {}): Promise<BrowserSession> {
  const portal = portalFromUrl(url);
  const statePath = storageStatePath(portal);
  const hasState = await storageStateExists(portal);
  const session = await launchSession({
    storageState: hasState ? statePath : undefined,
    headless: options.headless,
  });

  if (hasState) {
    logger.info(`Loaded saved browser session for ${portal}`);
  } else {
    logger.info(`No saved session for ${portal}. Opening a fresh browser.`);
  }

  return session;
}

export async function saveSession(session: BrowserSession, portal: string): Promise<string> {
  const target = storageStatePath(portal);
  await session.context.storageState({ path: target });
  logger.info(`Saved browser session for ${portal}`);
  return target;
}

export async function promptManualLogin(session: BrowserSession, portal: string, startUrl: string): Promise<void> {
  await session.page.goto(startUrl, { waitUntil: "domcontentloaded" });
  logger.warn(`Complete login / OTP / CAPTCHA manually for ${portal}, then return here.`);
  if (!process.stdin.isTTY) {
    logger.warn("No interactive terminal available. Continuing without waiting for login.");
    return;
  }
  const rl = createInterface({ input: stdin, output: stdout });
  await rl.question("Press Enter after you have finished logging in...");
  rl.close();
  await saveSession(session, portal);
}

export async function withOptionalAuth<T>(url: string, fn: (session: BrowserSession) => Promise<T>): Promise<T> {
  const session = await openAuthenticatedSession(url);
  try {
    return await fn(session);
  } finally {
    await closeSession(session);
  }
}
