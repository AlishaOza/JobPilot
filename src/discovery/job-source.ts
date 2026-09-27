import type { Page } from "playwright";
import type { JobInput } from "../jobs/job.types";

export interface DiscoveryQuery {
  roles: string[];
  locations: string[];
  skills: string[];
  experienceBand: string;
  experienceMonths: number;
  workModes: string[];
  maxAgeDays: number;
  maxSearches: number;
  maxJobs: number;
  country: string;
}

export type DiscoveredJob = JobInput;

export interface JobSourceAdapter {
  readonly name: string;
  canHandle(sourceId: string): boolean;
  search(page: Page, query: DiscoveryQuery): Promise<DiscoveredJob[]>;
}

/** Discovery-only adapter. Application destinations use ApplicationAdapter. */
export type JobSource = JobSourceAdapter;

export function selectJobSources(sourceIds: string[], registry: JobSource[]): JobSource[] {
  const selected: JobSource[] = [];
  for (const id of sourceIds) {
    const match = registry.find((source) => source.canHandle(id.trim().toLowerCase()));
    if (match && !selected.includes(match)) {
      selected.push(match);
    }
  }
  return selected;
}
