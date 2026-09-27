import type { Page } from "playwright";
import type { UserProfile } from "../profile/profile.schema";
import { logger } from "../utils/logger";

interface FieldTarget {
  labels: RegExp;
  value: string;
}

async function fillByLabel(page: Page, label: RegExp, value: string): Promise<boolean> {
  const locator = page.getByLabel(label).first();
  if ((await locator.count()) === 0) {
    return false;
  }
  if (!(await locator.isVisible().catch(() => false))) {
    return false;
  }
  const tag = await locator.evaluate((el) => el.tagName.toLowerCase()).catch(() => "");
  const type = await locator.getAttribute("type");
  if (tag === "select") {
    await locator.selectOption({ label: value }).catch(async () => {
      await locator.selectOption({ value });
    });
    return true;
  }
  if (type === "checkbox") {
    if (/^(yes|true|immediate|1)$/i.test(value)) {
      await locator.check();
    }
    return true;
  }
  await locator.fill(value);
  return true;
}

async function fillByPlaceholder(page: Page, label: RegExp, value: string): Promise<boolean> {
  const locator = page.getByPlaceholder(label).first();
  if ((await locator.count()) === 0) {
    return false;
  }
  if (!(await locator.isVisible().catch(() => false))) {
    return false;
  }
  await locator.fill(value);
  return true;
}

export async function fillIfPresent(page: Page, label: RegExp, value: string): Promise<boolean> {
  if (!value) {
    return false;
  }
  if (await fillByLabel(page, label, value)) {
    return true;
  }
  return fillByPlaceholder(page, label, value);
}

export async function fillDetectedQuestion(
  page: Page,
  field: { question: string; type: string },
  value: string,
): Promise<boolean> {
  if (!value || value === "NEEDS_USER_INPUT") {
    return false;
  }

  if (field.type === "radio") {
    const named = page.getByRole("radio", { name: new RegExp(escapeRegExp(value), "i") }).first();
    if ((await named.count()) > 0) {
      await named.check();
      return true;
    }
  }

  if (field.type === "checkbox") {
    const box = page.getByLabel(new RegExp(escapeRegExp(field.question).slice(0, 60), "i")).first();
    if ((await box.count()) > 0 && /^(yes|true|immediate|1)$/i.test(value)) {
      await box.check();
      return true;
    }
  }

  return fillIfPresent(page, new RegExp(escapeRegExp(field.question).slice(0, 60), "i"), value);
}

export async function fillProfileFields(page: Page, profile: UserProfile): Promise<string[]> {
  const filled: string[] = [];
  const fields: FieldTarget[] = [
    { labels: /full name|^name$/i, value: profile.name },
    { labels: /email/i, value: profile.email },
    { labels: /phone|mobile/i, value: profile.phone },
    { labels: /location|city|current location/i, value: profile.location },
    { labels: /linkedin/i, value: profile.links.linkedin },
    { labels: /github/i, value: profile.links.github },
    { labels: /portfolio|website/i, value: profile.links.portfolio },
    { labels: /availability|notice/i, value: profile.availability },
  ];

  for (const field of fields) {
    if (await fillIfPresent(page, field.labels, field.value)) {
      filled.push(field.labels.source);
    }
  }

  logger.info(`Filled ${filled.length} profile fields`);
  return filled;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
