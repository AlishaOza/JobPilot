import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { collectIndeedCards, IndeedJobSource, buildIndeedSearchUrl } from "../src/discovery/adapters/indeed-source";
import { dedupeJobs, filterFreshDiscoveries, seenUrlSet } from "../src/discovery/dedupe";
import { discoverNewJobs } from "../src/discovery/discover";
import { mergeJobHistory } from "../src/discovery/history";
import type { JobSource } from "../src/discovery/job-source";
import { buildDiscoveryQuery, isEntryLevel } from "../src/discovery/search-query";
import type { JobInput } from "../src/jobs/job.types";
import { canonicalizeJobUrl } from "../src/jobs/normalize-job";
import { loadTestEnv, sampleRecord, testProfile, withTempDir } from "./helpers";

class StaticJobSource implements JobSource {
  readonly name: string;
  constructor(
    name: string,
    private readonly jobs: JobInput[],
  ) {
    this.name = name;
  }

  canHandle(sourceId: string): boolean {
    return sourceId === this.name;
  }

  async search(): Promise<JobInput[]> {
    return this.jobs;
  }
}

const NOW = new Date("2026-09-27T12:00:00.000Z");

describe("job discovery query building", () => {
  it("uses configured roles, locations, skills, and experience without AI", async () => {
    const dir = await withTempDir();
    loadTestEnv(dir);
    const query = buildDiscoveryQuery(testProfile());
    expect(query.roles).toEqual(["Frontend Developer"]);
    expect(query.locations).toEqual(["Pune", "Remote"]);
    expect(query.skills).toEqual(["Angular", "React", "TypeScript", "JavaScript"]);
    expect(isEntryLevel(query)).toBe(true);
    expect(query.maxAgeDays).toBe(21);
  });
});

describe("discovery freshness and dedupe", () => {
  it("keeps jobs within 21 days and drops older ones", () => {
    const result = filterFreshDiscoveries(
      [
        { company: "A", role: "Dev", location: "Pune", jobUrl: "https://in.indeed.com/viewjob?jk=1", source: "Indeed", posted: "Posted 2 days ago" },
        { company: "B", role: "Dev", location: "Pune", jobUrl: "https://in.indeed.com/viewjob?jk=2", source: "Indeed", posted: "Posted 30 days ago" },
        { company: "C", role: "Dev", location: "Pune", jobUrl: "https://in.indeed.com/viewjob?jk=3", source: "Indeed" },
      ],
      21,
      NOW,
    );
    expect(result.kept.map((job) => job.company)).toEqual(["A", "C"]);
    expect(result.skippedOld).toHaveLength(1);
    expect(result.unknownDate).toHaveLength(1);
  });

  it("removes duplicates and already processed URLs", () => {
    const seen = seenUrlSet(["https://in.indeed.com/viewjob?jk=fresh123&utm_source=share"]);
    const unique = dedupeJobs(
      [
        { company: "A", role: "Dev", location: "Pune", jobUrl: "https://www.indeed.com/viewjob?jk=fresh123&from=search", source: "Indeed" },
        { company: "B", role: "Dev", location: "Pune", jobUrl: "https://in.indeed.com/viewjob?jk=new999", source: "Indeed" },
        { company: "B", role: "Dev", location: "Pune", jobUrl: "https://in.indeed.com/viewjob?jk=new999&utm_campaign=x", source: "Indeed" },
      ],
      seen,
    );
    expect(unique).toHaveLength(1);
    expect(unique[0]?.jobUrl).toBe("https://in.indeed.com/viewjob?jk=new999");
  });

  it("merges discovered jobs into history without duplicating", () => {
    const merged = mergeJobHistory(
      [{ company: "Old", role: "Dev", location: "Pune", jobUrl: "https://in.indeed.com/viewjob?jk=old", source: "Indeed" }],
      [
        { company: "Old", role: "Dev", location: "Pune", jobUrl: "https://in.indeed.com/viewjob?jk=old&from=x", source: "Indeed" },
        { company: "New", role: "Dev", location: "Pune", jobUrl: "https://in.indeed.com/viewjob?jk=new", source: "Indeed" },
      ],
    );
    expect(merged).toHaveLength(2);
    expect(merged.map((job) => job.company)).toEqual(["Old", "New"]);
  });
});

describe("Indeed adapter", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("builds a country-specific search URL from the profile query", () => {
    const url = buildIndeedSearchUrl(
      {
        roles: ["Frontend Developer"],
        locations: ["Pune"],
        skills: ["Angular", "React"],
        experienceBand: "0-2 years",
        experienceMonths: 10,
        workModes: ["Remote"],
        maxAgeDays: 21,
        maxSearches: 6,
        maxJobs: 30,
        country: "in",
      },
      "Frontend Developer",
      "Pune",
    );
    expect(url).toContain("https://in.indeed.com/jobs?");
    expect(url).toContain("Frontend");
    expect(url).toContain("Pune");
    expect(url).toContain("fromage=14");
    expect(url).toContain("explvl=entry_level");
  });

  it("parses job cards from a local Indeed results page", async () => {
    const fileUrl = pathToFileURL(path.resolve("tests/fixtures/indeed-search.html")).href;
    await page.goto(fileUrl);
    const jobs = await collectIndeedCards(page);
    expect(jobs).toHaveLength(3);
    expect(jobs[0]?.company).toBe("Example Tech");
    expect(jobs[0]?.role).toBe("Frontend Developer");
    expect(jobs[0]?.jobUrl).toContain("jk=fresh123");
    expect(jobs[0]?.posted).toContain("2 days ago");
  });

  it("collects listings through the JobSource interface", async () => {
    const fileUrl = pathToFileURL(path.resolve("tests/fixtures/indeed-search.html")).href;
    const source = new IndeedJobSource({ startUrl: fileUrl });
    const jobs = await source.search(page, {
      roles: ["Frontend Developer"],
      locations: ["Pune"],
      skills: ["React"],
      experienceBand: "0-2 years",
      experienceMonths: 10,
      workModes: [],
      maxAgeDays: 21,
      maxSearches: 1,
      maxJobs: 30,
      country: "in",
    });
    expect(jobs.some((job) => job.role === "Frontend Developer")).toBe(true);
  });
});

describe("discovery orchestration", () => {
  it("keeps only fresh unseen jobs from the configured source", async () => {
    const dir = await withTempDir();
    const { resetEnvCache, loadEnv } = await import("../src/config/env");
    resetEnvCache();
    loadEnv({
      AI_PROVIDER: "heuristic",
      DISCOVERY_ENABLED: "true",
      JOB_SOURCES: "fixture",
      MAX_JOB_AGE_DAYS: "21",
      JOBS_FILE: path.join(dir, "jobs.xlsx"),
      STATE_FILE: path.join(dir, "state.json"),
      DISCOVERY_HISTORY_FILE: path.join(dir, "discovery-history.json"),
    });

    const source = new StaticJobSource("fixture", [
      { company: "Fresh Co", role: "Frontend Developer", location: "Pune", jobUrl: "https://in.indeed.com/viewjob?jk=aaa", source: "Fixture", posted: "Posted 2 days ago" },
      { company: "Old Co", role: "Frontend Developer", location: "Pune", jobUrl: "https://in.indeed.com/viewjob?jk=bbb", source: "Fixture", posted: "Posted 40 days ago" },
      { company: "Seen Co", role: "Frontend Developer", location: "Pune", jobUrl: "https://in.indeed.com/viewjob?jk=ccc", source: "Fixture", posted: "Posted 1 day ago" },
    ]);

    const kept = await discoverNewJobs(
      {} as Page,
      testProfile(),
      [],
      [sampleRecord({ jobUrl: "https://in.indeed.com/viewjob?jk=ccc" })],
      { seenUrls: [], lastRunAt: null, runs: [] },
      [source],
    );

    expect(kept).toHaveLength(1);
    expect(kept[0]?.company).toBe("Fresh Co");
    expect(canonicalizeJobUrl(kept[0]?.jobUrl ?? "")).toContain("jk=aaa");
    loadTestEnv(dir);
  });
});
