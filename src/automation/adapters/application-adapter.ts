import type { Page } from "playwright";
import type { AnsweredQuestion } from "../../ai/question-answer";
import type { AiProvider } from "../../ai/ai-provider";
import type { ExtractedJob } from "../../jobs/job.types";
import type { Resume, UserProfile } from "../../profile/profile.schema";
import type { ReviewState } from "../review-state";

export interface ApplicationContext {
  job: ExtractedJob;
  profile: UserProfile;
  resume: Resume;
  provider?: AiProvider;
}

export interface ApplicationAdapter {
  name: string;
  canHandle(applyUrl: string): boolean;
  openApplication(page: Page, job: ExtractedJob): Promise<void>;
  fillProfile(page: Page, profile: UserProfile): Promise<void>;
  uploadResume(page: Page, resume: Resume): Promise<void>;
  answerQuestions(page: Page, context: ApplicationContext): Promise<AnsweredQuestion[]>;
  detectReviewState(page: Page): Promise<ReviewState>;
}

export function applyUrlOf(job: ExtractedJob): string {
  return job.applyUrl || job.applicationUrl || job.jobUrl || job.originalUrl;
}

export function selectApplicationAdapter(adapters: ApplicationAdapter[], applyUrl: string): ApplicationAdapter {
  const specific = adapters.find((adapter) => adapter.name !== "generic" && adapter.canHandle(applyUrl));
  if (specific) {
    return specific;
  }
  const generic = adapters.find((adapter) => adapter.name === "generic" && adapter.canHandle(applyUrl));
  if (generic) {
    return generic;
  }
  const fallback = adapters[0];
  if (!fallback) {
    throw new Error("No application adapters registered");
  }
  return fallback;
}

/** @deprecated Use selectApplicationAdapter. Kept for existing imports. */
export const selectAdapter = selectApplicationAdapter;
