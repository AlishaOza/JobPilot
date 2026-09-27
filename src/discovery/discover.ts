import type { Page } from "playwright";
import { getEnv } from "../config/env";
import type { JobInput } from "../jobs/job.types";
import { jobIdentity } from "../jobs/normalize-job";
import type { UserProfile } from "../profile/profile.schema";
import type { ApplicationRecord } from "../state/state-store";
import { logger } from "../utils/logger";
import { IndeedJobSource } from "./adapters/indeed-source";
import { dedupeJobs, filterFreshDiscoveries, seenUrlSet } from "./dedupe";
import { persistDiscoveredJobs, type DiscoveryHistory } from "./history";
import { selectJobSources, type JobSource } from "./job-source";

export type { JobSource } from "./job-source";
import { buildDiscoveryQuery } from "./search-query";

export const DEFAULT_JOB_SOURCES: JobSource[] = [new IndeedJobSource()];

export function configuredSourceIds(): string[] {
  return getEnv()
    .JOB_SOURCES.split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export async function discoverNewJobs(
  page: Page,
  profile: UserProfile,
  existingJobs: JobInput[],
  applications: ApplicationRecord[],
  history: DiscoveryHistory,
  sources: JobSource[] = DEFAULT_JOB_SOURCES,
): Promise<JobInput[]> {
  const env = getEnv();
  const query = buildDiscoveryQuery(profile);
  const selected = selectJobSources(configuredSourceIds(), sources);
  if (selected.length === 0) {
    logger.warn(`No job sources matched JOB_SOURCES=${env.JOB_SOURCES}. Add an adapter or change the setting.`);
    return [];
  }

  const collected: JobInput[] = [];
  for (const source of selected) {
    logger.info(`Running job discovery: ${source.name}`);
    try {
      const found = await source.search(page, query);
      logger.info(`${source.name} returned ${found.length} listings`);
      collected.push(...found);
    } catch (error) {
      const reason = error instanceof Error ? error.message : "discovery failed";
      logger.error(`Discovery source ${source.name} failed: ${reason}`);
    }
  }

  const alreadySeen = seenUrlSet([
    ...existingJobs.map((job) => job.jobUrl),
    ...applications.flatMap((item) => [item.jobUrl, item.applicationUrl]),
    ...history.seenUrls,
  ]);

  const unique = dedupeJobs(collected, alreadySeen);
  const freshness = filterFreshDiscoveries(unique, env.MAX_JOB_AGE_DAYS);
  logger.info(
    `Discovery kept ${freshness.kept.length} new jobs (${freshness.skippedOld.length} older than ${env.MAX_JOB_AGE_DAYS} days, ${freshness.unknownDate.length} missing a posting date)`,
  );
  return freshness.kept;
}

export async function runDiscovery(
  page: Page,
  profile: UserProfile,
  existingJobs: JobInput[],
  applications: ApplicationRecord[],
  history: DiscoveryHistory,
  sources?: JobSource[],
): Promise<JobInput[]> {
  const discovered = await discoverNewJobs(page, profile, existingJobs, applications, history, sources);
  if (discovered.length === 0) {
    logger.info("No new discovered jobs to add.");
    return existingJobs;
  }
  const persisted = await persistDiscoveredJobs(
    existingJobs,
    discovered,
    history,
    configuredSourceIds(),
  );
  logger.info(`Added ${discovered.length} discovered jobs to jobs.xlsx history`);
  return persisted.jobs;
}

export function newJobsToProcess(allJobs: JobInput[], applications: ApplicationRecord[]): JobInput[] {
  const processed = seenUrlSet(applications.flatMap((item) => [item.jobUrl, item.applicationUrl]));
  const retryable = new Set(
    applications
      .filter((item) => ["FAILED", "FOUND", "POSTING_DATE_UNKNOWN"].includes(item.status))
      .map((item) => jobIdentity(item.jobUrl)),
  );
  return allJobs.filter((job) => {
    const key = jobIdentity(job.jobUrl);
    if (retryable.has(key)) {
      return true;
    }
    return !processed.has(key);
  });
}
