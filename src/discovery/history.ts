import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getPaths } from "../config/paths";
import { writeJobsWorkbook } from "../excel/jobs-export";
import { canonicalizeJobUrl, jobIdentity } from "../jobs/normalize-job";
import type { JobInput } from "../jobs/job.types";

export interface DiscoveryHistory {
  seenUrls: string[];
  lastRunAt: string | null;
  runs: Array<{
    at: string;
    source: string;
    found: number;
    kept: number;
  }>;
}

function emptyHistory(): DiscoveryHistory {
  return { seenUrls: [], lastRunAt: null, runs: [] };
}

export async function loadDiscoveryHistory(filePath?: string): Promise<DiscoveryHistory> {
  const target = filePath ?? getPaths().discoveryHistory;
  try {
    const raw = await readFile(target, "utf8");
    const parsed = JSON.parse(raw) as DiscoveryHistory;
    return {
      seenUrls: Array.isArray(parsed.seenUrls) ? parsed.seenUrls : [],
      lastRunAt: parsed.lastRunAt ?? null,
      runs: Array.isArray(parsed.runs) ? parsed.runs : [],
    };
  } catch {
    return emptyHistory();
  }
}

export async function saveDiscoveryHistory(history: DiscoveryHistory, filePath?: string): Promise<void> {
  const target = filePath ?? getPaths().discoveryHistory;
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(history, null, 2), "utf8");
}

export function mergeJobHistory(existing: JobInput[], discovered: JobInput[]): JobInput[] {
  const merged: JobInput[] = [];
  const seen = new Set<string>();
  for (const job of [...existing, ...discovered]) {
    const key = jobIdentity(job.jobUrl);
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    merged.push({ ...job, jobUrl: canonicalizeJobUrl(job.jobUrl) });
  }
  return merged;
}

export async function persistDiscoveredJobs(
  existing: JobInput[],
  discovered: JobInput[],
  history: DiscoveryHistory,
  sourceNames: string[],
): Promise<{ jobs: JobInput[]; history: DiscoveryHistory }> {
  const jobs = mergeJobHistory(existing, discovered);
  await writeJobsWorkbook(jobs);
  const next: DiscoveryHistory = {
    seenUrls: jobs.map((job) => jobIdentity(job.jobUrl)),
    lastRunAt: new Date().toISOString(),
    runs: [
      ...history.runs.slice(-19),
      {
        at: new Date().toISOString(),
        source: sourceNames.join(",") || "none",
        found: discovered.length,
        kept: discovered.length,
      },
    ],
  };
  await saveDiscoveryHistory(next);
  return { jobs, history: next };
}
