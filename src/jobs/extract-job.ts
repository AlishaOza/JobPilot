import type { Page } from "playwright";
import { parsePostedDate } from "./posting-date";
import { resolveApplyDestination } from "./apply-destination";
import type { ExtractedJob, JobInput } from "./job.types";
import { extractSkillHints, mergeExtractedJob } from "./normalize-job";

const TITLE_SELECTORS = ["h1", "[data-testid='jobTitle']", "[class*='job-title']", "[class*='jobTitle']"];
const COMPANY_SELECTORS = ["[data-testid='company']", "[class*='company']", "[itemprop='hiringOrganization']"];
const LOCATION_SELECTORS = ["[data-testid='location']", "[class*='location']", "[itemprop='jobLocation']"];
const DESCRIPTION_SELECTORS = [
  "[data-testid='jobDescription']",
  "[class*='job-description']",
  "[class*='jobDescription']",
  "#jobDescriptionText",
  "article",
  "main",
];
const POSTED_SELECTORS = [
  "time",
  "[data-testid*='date']",
  "[class*='posted']",
  "[class*='posting-date']",
  "[datetime]",
];

async function firstText(page: Page, selectors: string[]): Promise<string> {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0) {
      continue;
    }
    const text = (await locator.innerText().catch(() => "")).trim();
    if (text) {
      return text;
    }
  }
  return "";
}

export async function extractJobFromPage(page: Page, input: JobInput, knownSkills: string[] = []): Promise<ExtractedJob> {
  await page.waitForLoadState("domcontentloaded");
  await page.waitForLoadState("networkidle").catch(() => undefined);

  const title = (await firstText(page, TITLE_SELECTORS)) || (await page.title());
  const company = await firstText(page, COMPANY_SELECTORS);
  const location = await firstText(page, LOCATION_SELECTORS);
  const description = (await firstText(page, DESCRIPTION_SELECTORS)) || (await page.locator("body").innerText().catch(() => ""));
  const salaryMatch = description.match(/(?:₹|INR|USD|\$|Rs\.?)\s?[\d,]+(?:\s?-\s?[\d,]+)?/i);
  const postedText = await extractPostedText(page, description) || input.posted || null;
  const postedAt = input.postedAt || parsePostedDate(postedText)?.toISOString() || null;
  const destination = await resolveApplyDestination(page, input.jobUrl, input.applyUrl);

  return mergeExtractedJob(input, {
    company,
    title,
    location,
    description,
    salary: salaryMatch?.[0] ?? null,
    skills: extractSkillHints(description, knownSkills),
    applyUrl: destination.applyUrl,
    source: input.source,
    jobUrl: input.jobUrl,
    postedText,
    postedAt,
    destinationKind: destination.kind,
  });
}

async function extractPostedText(page: Page, description: string): Promise<string> {
  const time = page.locator("time").first();
  if ((await time.count()) > 0) {
    const datetime = await time.getAttribute("datetime");
    const text = (await time.innerText().catch(() => "")).trim();
    if (datetime) {
      return datetime;
    }
    if (text) {
      return text;
    }
  }

  const posted = await firstText(page, POSTED_SELECTORS);
  if (posted) {
    return posted;
  }

  const match = description.match(/posted\s+[\w\d,\s/-]+ago|posted\s+\d{4}-\d{2}-\d{2}|posted\s+[A-Za-z]{3,9}\s+\d{1,2},?\s+\d{4}/i);
  return match?.[0] ?? "";
}
