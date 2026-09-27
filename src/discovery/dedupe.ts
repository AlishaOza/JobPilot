import { canonicalizeJobUrl, jobIdentity } from "../jobs/normalize-job";
import { evaluateFreshness, type PostingStatus } from "../jobs/posting-date";
import type { JobInput } from "../jobs/job.types";

export function seenUrlSet(urls: Array<string | null | undefined>): Set<string> {
  const seen = new Set<string>();
  for (const url of urls) {
    if (!url) {
      continue;
    }
    const identity = jobIdentity(url);
    if (identity) {
      seen.add(identity);
    }
  }
  return seen;
}

export function isDuplicate(job: JobInput, seen: Set<string>): boolean {
  return seen.has(jobIdentity(job.jobUrl));
}

export function filterFreshDiscoveries(
  jobs: JobInput[],
  maxAgeDays: number,
  now = new Date(),
): { kept: JobInput[]; skippedOld: JobInput[]; unknownDate: JobInput[] } {
  const kept: JobInput[] = [];
  const skippedOld: JobInput[] = [];
  const unknownDate: JobInput[] = [];

  for (const job of jobs) {
    const freshness = evaluateFreshness(job.posted ?? job.postedAt, maxAgeDays, now);
    if (freshness.status === "SKIPPED_OLD") {
      skippedOld.push(job);
      continue;
    }
    if (freshness.status === "POSTING_DATE_UNKNOWN") {
      unknownDate.push(job);
    }
    kept.push(job);
  }

  return { kept, skippedOld, unknownDate };
}

export function dedupeJobs(jobs: JobInput[], alreadySeen: Set<string>): JobInput[] {
  const unique: JobInput[] = [];
  const local = new Set(alreadySeen);
  for (const job of jobs) {
    const key = jobIdentity(job.jobUrl);
    if (!key || local.has(key)) {
      continue;
    }
    local.add(key);
    unique.push({ ...job, jobUrl: canonicalizeJobUrl(job.jobUrl) });
  }
  return unique;
}

export function postingStatusOf(job: JobInput, maxAgeDays: number, now = new Date()): PostingStatus {
  return evaluateFreshness(job.posted ?? job.postedAt, maxAgeDays, now).status;
}
