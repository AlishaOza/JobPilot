import type { Page } from "playwright";
import { logger } from "../../utils/logger";
import { withRetry } from "../../utils/retry";
import type { DiscoveryQuery, DiscoveredJob, JobSource } from "../job-source";
import { indeedFromAge, isEntryLevel } from "../search-query";

export interface IndeedSourceOptions {
  country?: string;
  startUrl?: string;
}

export function indeedHost(country: string): string {
  const code = country.trim().toLowerCase();
  if (!code || code === "us" || code === "www") {
    return "https://www.indeed.com";
  }
  return `https://${code}.indeed.com`;
}

export function buildIndeedSearchUrl(
  query: DiscoveryQuery,
  role: string,
  location: string,
  country = query.country,
): string {
  const terms = [role, ...query.skills.slice(0, 3)].filter(Boolean).join(" ");
  const params = new URLSearchParams({
    q: terms,
    l: location,
    fromage: String(indeedFromAge(query.maxAgeDays)),
    sort: "date",
  });
  if (isEntryLevel(query)) {
    params.set("explvl", "entry_level");
  }
  return `${indeedHost(country)}/jobs?${params.toString()}`;
}

export function buildIndeedSearchUrls(query: DiscoveryQuery): string[] {
  const urls: string[] = [];
  for (const role of query.roles) {
    for (const location of query.locations) {
      urls.push(buildIndeedSearchUrl(query, role, location));
      if (urls.length >= query.maxSearches) {
        return urls;
      }
    }
  }
  return urls;
}

export async function collectIndeedCards(page: Page): Promise<DiscoveredJob[]> {
  const raw = (await page.evaluate(`(() => {
    const cards = Array.from(document.querySelectorAll("[data-jk], .job_seen_beacon, .resultContent"));
    return cards.map((card) => {
      const jk = card.getAttribute("data-jk") || (card.querySelector("[data-jk]") && card.querySelector("[data-jk]").getAttribute("data-jk")) || "";
      const titleLink = card.querySelector("a.jcs-JobTitle, h2.jobTitle a, a[data-jk]");
      const company = card.querySelector("[data-testid='company-name'], .companyName, [data-testid='company-name'] span");
      const location = card.querySelector("[data-testid='text-location'], .companyLocation");
      const posted = card.querySelector(".date, [data-testid='myJobsStateDate'], span.date");
      const href = titleLink ? titleLink.getAttribute("href") || "" : "";
      return {
        jk,
        role: titleLink ? (titleLink.textContent || "").replace(/\\s+/g, " ").trim() : "",
        company: company ? (company.textContent || "").replace(/\\s+/g, " ").trim() : "",
        location: location ? (location.textContent || "").replace(/\\s+/g, " ").trim() : "",
        posted: posted ? (posted.textContent || "").replace(/\\s+/g, " ").trim() : "",
        href,
      };
    });
  })()`)) as Array<{ jk: string; role: string; company: string; location: string; posted: string; href: string }>;

  const jobs: DiscoveredJob[] = [];
  for (const item of raw) {
    const jobUrl = resolveIndeedUrl(page.url(), item.href, item.jk);
    if (!jobUrl || !item.role || !item.company) {
      continue;
    }
    jobs.push({
      company: item.company,
      role: item.role,
      location: item.location || "Unknown",
      jobUrl,
      source: "Indeed",
      ...(item.posted ? { posted: item.posted } : {}),
    });
  }
  return jobs;
}

function resolveIndeedUrl(pageUrl: string, href: string, jk: string): string {
  if (jk) {
    try {
      const origin = new URL(pageUrl).origin;
      return `${origin}/viewjob?jk=${jk}`;
    } catch {
      return href;
    }
  }
  if (!href) {
    return "";
  }
  try {
    return new URL(href, pageUrl).toString();
  } catch {
    return "";
  }
}

export async function pageLooksBlocked(page: Page): Promise<boolean> {
  const url = page.url().toLowerCase();
  if (/consent|verify|captcha|checkpoint|security-check/.test(url)) {
    return true;
  }
  const text = (await page.locator("body").innerText().catch(() => "")).slice(0, 2_000);
  return /unusual traffic|are you a robot|verify you are human|enable javascript and cookies|access denied/i.test(text);
}

export class IndeedJobSource implements JobSource {
  readonly name = "indeed";
  private readonly options: IndeedSourceOptions;

  constructor(options: IndeedSourceOptions = {}) {
    this.options = options;
  }

  canHandle(sourceId: string): boolean {
    return sourceId.trim().toLowerCase() === "indeed";
  }

  async search(page: Page, query: DiscoveryQuery): Promise<DiscoveredJob[]> {
    const urls = this.options.startUrl ? [this.options.startUrl] : buildIndeedSearchUrls(query);
    const found: DiscoveredJob[] = [];

    for (const url of urls) {
      if (found.length >= query.maxJobs) {
        break;
      }
      logger.info(`Discovering Indeed jobs: ${url}`);
      try {
        await withRetry(
          async () => {
            await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25_000 });
            await page.waitForLoadState("networkidle").catch(() => undefined);
          },
          { attempts: 2, label: "Indeed search navigation" },
        );
      } catch (error) {
        const reason = error instanceof Error ? error.message : "navigation failed";
        logger.warn(`Indeed search failed: ${reason}`);
        continue;
      }

      if (await pageLooksBlocked(page)) {
        logger.warn("Indeed presented a challenge. Complete it manually if the browser is visible; discovery will continue with jobs already found.");
        break;
      }

      const cards = await collectIndeedCards(page);
      found.push(...cards);
    }

    return found.slice(0, query.maxJobs);
  }
}
