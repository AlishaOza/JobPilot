import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AnsweredQuestion } from "../ai/question-answer";
import { getPaths } from "../config/paths";
import type { ApplyDestinationKind } from "../jobs/apply-destination";
import { jobIdentity } from "../jobs/normalize-job";
import type { PostingStatus } from "../jobs/posting-date";
import { assertTransition, type ApplicationStatus } from "./application-state";

export interface ApplicationRecord {
  id: string;
  company: string;
  role: string;
  location: string;
  jobUrl: string;
  applyUrl: string;
  applicationUrl: string;
  destinationKind: ApplyDestinationKind | null;
  source: string;
  description: string;
  salary: string | null;
  skills: string[];
  resume: string;
  status: ApplicationStatus;
  postingStatus: PostingStatus | null;
  postedAt: string | null;
  postedText: string | null;
  manualReview: boolean;
  missingInformation: string[];
  answeredQuestions: AnsweredQuestion[];
  notes: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  followUpDate: string | null;
}

export interface AppState {
  applications: ApplicationRecord[];
}

function emptyState(): AppState {
  return { applications: [] };
}

export async function loadState(filePath?: string): Promise<AppState> {
  const target = filePath ?? getPaths().state;
  try {
    const raw = await readFile(target, "utf8");
    const parsed = JSON.parse(raw) as AppState;
    if (!Array.isArray(parsed.applications)) {
      return emptyState();
    }
    return parsed;
  } catch {
    return emptyState();
  }
}

export async function saveState(state: AppState, filePath?: string): Promise<void> {
  const target = filePath ?? getPaths().state;
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, JSON.stringify(state, null, 2), "utf8");
}

export function upsertApplication(state: AppState, record: ApplicationRecord): ApplicationRecord {
  const index = state.applications.findIndex((item) => item.id === record.id);
  if (index === -1) {
    state.applications.push(record);
    return record;
  }
  state.applications[index] = record;
  return record;
}

export function getApplication(state: AppState, id: string): ApplicationRecord | undefined {
  return state.applications.find((item) => item.id === id);
}

export function findByJobUrl(state: AppState, jobUrl: string): ApplicationRecord | undefined {
  const identity = jobIdentity(jobUrl);
  return state.applications.find(
    (item) => jobIdentity(item.jobUrl) === identity || jobIdentity(item.applicationUrl) === identity,
  );
}

export function transitionApplication(
  record: ApplicationRecord,
  status: ApplicationStatus,
  extras: Partial<ApplicationRecord> = {},
): ApplicationRecord {
  assertTransition(record.status, status);
  return {
    ...record,
    ...extras,
    status,
    updatedAt: new Date().toISOString(),
  };
}

export function createApplicationId(jobUrl: string): string {
  const slug = jobUrl.replace(/[^a-zA-Z0-9]/g, "").slice(-10);
  return `JP-${slug || "job"}-${Math.abs(hashString(jobUrl)).toString(16)}`;
}

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return hash;
}
