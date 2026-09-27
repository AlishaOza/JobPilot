import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AiProvider } from "../src/ai/ai-provider";
import { loadEnv, resetEnvCache } from "../src/config/env";
import type { UserProfile } from "../src/profile/profile.schema";
import type { ApplicationRecord } from "../src/state/state-store";

export function testProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    name: "Test Candidate",
    email: "candidate@example.com",
    phone: "+91-1111111111",
    location: "Pune",
    experienceMonths: 10,
    availability: "Immediate",
    skills: ["Angular", "React", "TypeScript", "JavaScript", "Node.js", "MongoDB"],
    education: { degree: "B.Tech", college: "Example College" },
    links: {
      linkedin: "https://linkedin.com/in/example",
      github: "https://github.com/example",
      portfolio: "https://example.com",
    },
    resumes: [
      {
        name: "Frontend Resume",
        path: path.resolve("tests/fixtures/resume.pdf"),
        tags: ["frontend", "react"],
      },
      {
        name: "Full Stack Resume",
        path: path.resolve("tests/fixtures/resume.pdf"),
        tags: ["fullstack", "node"],
      },
    ],
    preferences: {
      roles: ["Frontend Developer"],
      locations: ["Pune", "Remote"],
      workModes: ["Remote"],
      experienceBand: "0-2 years",
    },
    ...overrides,
  };
}

export function sampleRecord(overrides: Partial<ApplicationRecord> = {}): ApplicationRecord {
  const timestamp = "2026-09-27T10:00:00.000Z";
  return {
    id: "JP-test-1",
    company: "Example Tech",
    role: "Frontend Developer",
    location: "Pune",
    jobUrl: "https://example.com/jobs/frontend",
    applyUrl: "https://example.com/jobs/frontend/apply",
    applicationUrl: "https://example.com/jobs/frontend/apply",
    destinationKind: "same_site",
    source: "Example",
    description: "React TypeScript frontend role in Pune",
    salary: null,
    skills: ["React", "TypeScript"],
    resume: "frontend",
    status: "FOUND",
    postingStatus: "FRESH",
    postedAt: "2026-09-25T00:00:00.000Z",
    postedText: "Posted 2 days ago",
    manualReview: false,
    missingInformation: [],
    answeredQuestions: [],
    notes: "",
    createdAt: timestamp,
    updatedAt: timestamp,
    submittedAt: null,
    followUpDate: null,
    ...overrides,
  };
}

export async function withTempDir(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "jobpilot-"));
}

export async function writeTempProfile(dir: string, profile = testProfile()): Promise<string> {
  const filePath = path.join(dir, "profile.json");
  await writeFile(filePath, JSON.stringify(profile, null, 2), "utf8");
  return filePath;
}

export function loadTestEnv(dir: string): void {
  resetEnvCache();
  loadEnv({
    AI_PROVIDER: "heuristic",
    HEADLESS: "true",
    PAUSE_BEFORE_SUBMIT: "true",
    MAX_JOB_AGE_DAYS: "21",
    DISCOVERY_ENABLED: "false",
    JOB_SOURCES: "indeed",
    JOB_SOURCE_COUNTRY: "in",
    PROFILE_PATH: path.join(dir, "profile.json"),
    JOBS_FILE: path.join(dir, "jobs.xlsx"),
    APPLICATIONS_FILE: path.join(dir, "applications.xlsx"),
    CONTACTS_FILE: path.join(dir, "contacts.xlsx"),
    STATE_FILE: path.join(dir, "state.json"),
    STORAGE_DIR: path.join(dir, "storage"),
    SCREENSHOTS_DIR: path.join(dir, "screenshots"),
    REPORTS_DIR: path.join(dir, "reports"),
    DISCOVERY_HISTORY_FILE: path.join(dir, "discovery-history.json"),
  });
}

export class TrackingAiProvider implements AiProvider {
  readonly name = "tracking";
  readonly calls: string[] = [];
  readonly answer: string;

  constructor(answer = "I want to join because the role uses Angular and React from my profile.") {
    this.answer = answer;
  }

  async completeJson(prompt: string): Promise<unknown> {
    this.calls.push(prompt);
    return { answer: this.answer, confidence: "HIGH", needsUserInput: false };
  }

  async completeText(prompt: string): Promise<string> {
    this.calls.push(prompt);
    return this.answer;
  }
}

export function sampleJob(applicationUrl: string) {
  return {
    company: "Example Tech",
    title: "Frontend Developer",
    location: "Pune",
    description: "React TypeScript frontend role posted 2 days ago",
    salary: null,
    skills: ["React"],
    jobUrl: applicationUrl,
    applyUrl: applicationUrl,
    applicationUrl,
    originalUrl: applicationUrl,
    source: "Fixture",
    postedText: "Posted 2 days ago",
    postedAt: "2026-09-25T12:00:00.000Z",
    destinationKind: "same_site" as const,
  };
}
