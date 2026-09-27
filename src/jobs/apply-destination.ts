import type { Page } from "playwright";
import { logger } from "../utils/logger";

export type ApplyDestinationKind = "same_site" | "external" | "unknown";

export interface ApplyLink {
  url: string;
  label: string;
}

export interface ApplyDestination {
  applyUrl: string;
  kind: ApplyDestinationKind;
  reason: string;
}

const ATS_HOST =
  /greenhouse\.io|lever\.co|myworkdayjobs\.com|ashbyhq\.com|smartrecruiters\.com|icims\.com|taleo\.net|successfactors\.com|workable\.com|jobvite\.com|bamboohr\.com|recruitee\.com|wellfound\.com|boards\.eu\.greenhouse\.io/i;

const APPLY_HINT = /apply|application/i;
const EXTERNAL_LABEL = /apply on (company|employer)|company (site|website)|external apply|apply externally|apply on the company/i;

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function isSameSite(jobUrl: string, applyUrl: string): boolean {
  try {
    const job = new URL(jobUrl);
    const apply = new URL(applyUrl);
    if (job.protocol === "file:" && apply.protocol === "file:") {
      return true;
    }
    const jobHost = job.hostname.replace(/^www\./, "").toLowerCase();
    const applyHost = apply.hostname.replace(/^www\./, "").toLowerCase();
    return Boolean(jobHost && applyHost && jobHost === applyHost);
  } catch {
    return false;
  }
}

export function isKnownAts(url: string): boolean {
  return ATS_HOST.test(url) || ATS_HOST.test(hostnameOf(url));
}

export function classifyApplyDestination(jobUrl: string, applyUrl: string): ApplyDestinationKind {
  if (!applyUrl) {
    return "unknown";
  }
  if (isSameSite(jobUrl, applyUrl)) {
    return "same_site";
  }
  return "external";
}

export function pickApplyDestination(
  jobUrl: string,
  candidates: ApplyLink[],
  knownApplyUrl?: string,
): ApplyDestination {
  const unique = dedupeLinks(candidates);
  const externalLabeled = unique.find((link) => EXTERNAL_LABEL.test(link.label) && !isSameSite(jobUrl, link.url));
  if (externalLabeled) {
    return destination(jobUrl, externalLabeled.url, "Labeled as company/external apply");
  }

  const ats = unique.find((link) => isKnownAts(link.url));
  if (ats) {
    return destination(jobUrl, ats.url, "Known external ATS URL");
  }

  const externalApply = unique.find((link) => APPLY_HINT.test(link.label) && !isSameSite(jobUrl, link.url));
  if (externalApply) {
    return destination(jobUrl, externalApply.url, "Apply link points off the listing site");
  }

  const sameSiteApply = unique.find((link) => APPLY_HINT.test(link.label) && isSameSite(jobUrl, link.url));
  if (sameSiteApply) {
    return destination(jobUrl, sameSiteApply.url, "Same-site apply link");
  }

  if (knownApplyUrl) {
    return destination(jobUrl, knownApplyUrl, "Apply URL already stored on the job");
  }

  if (unique[0]) {
    return destination(jobUrl, unique[0].url, "First apply-like link");
  }

  return destination(jobUrl, jobUrl, "No apply link found; listing URL used until resolved");
}

export async function collectApplyLinks(page: Page): Promise<ApplyLink[]> {
  const raw = (await page.evaluate(`(() => {
    const links = [];
    const nodes = Array.from(document.querySelectorAll("a[href], [data-indeed-apply-url]"));
    for (const node of nodes) {
      const label = (node.getAttribute("aria-label") || node.textContent || "").replace(/\\s+/g, " ").trim();
      const href = node.getAttribute("data-indeed-apply-url") || node.href || node.getAttribute("href") || "";
      if (!href || href.startsWith("javascript:") || href === "#") continue;
      const hay = (label + " " + href).toLowerCase();
      if (/apply|application|greenhouse|lever|workday|ashby|smartrecruiters|icims/.test(hay)) {
        links.push({ url: href, label: label || href });
      }
    }
    return links;
  })()`)) as ApplyLink[];

  return raw
    .map((link) => ({
      url: resolveAgainstPage(page.url(), link.url),
      label: link.label,
    }))
    .filter((link) => Boolean(link.url));
}

export async function resolveApplyDestination(
  page: Page,
  jobUrl: string,
  knownApplyUrl?: string,
): Promise<ApplyDestination> {
  const links = await collectApplyLinks(page);
  const picked = pickApplyDestination(jobUrl, links, knownApplyUrl);
  logger.info(`Apply destination (${picked.kind}): ${picked.applyUrl}`);
  return picked;
}

function destination(jobUrl: string, applyUrl: string, reason: string): ApplyDestination {
  return {
    applyUrl,
    kind: classifyApplyDestination(jobUrl, applyUrl),
    reason,
  };
}

function dedupeLinks(links: ApplyLink[]): ApplyLink[] {
  const seen = new Set<string>();
  const unique: ApplyLink[] = [];
  for (const link of links) {
    const key = link.url.split("#")[0] ?? link.url;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(link);
  }
  return unique;
}

function resolveAgainstPage(pageUrl: string, href: string): string {
  try {
    return new URL(href, pageUrl).toString();
  } catch {
    return href;
  }
}
