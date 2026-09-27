import type { Page } from "playwright";
import type { AiProvider } from "../ai/ai-provider";
import type { AnsweredQuestion } from "../ai/question-answer";
import { getEnv } from "../config/env";
import type { ExtractedJob } from "../jobs/job.types";
import { selectResumeForJob } from "../profile/deterministic-answers";
import { selectResume } from "../profile/profile";
import type { UserProfile } from "../profile/profile.schema";
import { ForbiddenActionError } from "../utils/errors";
import { logger } from "../utils/logger";
import { applyUrlOf, type ApplicationAdapter } from "./adapters/application-adapter";
import { DEFAULT_APPLICATION_ADAPTERS, routeApplicationAdapter } from "./adapters/registry";
import { captureFailureScreenshot } from "./browser";
import { isForbiddenSubmitName, type ReviewState } from "./review-state";

export interface PrepareOptions {
  resumeHint?: string;
  provider?: AiProvider;
  adapters?: ApplicationAdapter[];
}

export interface PrepareResult {
  applicationUrl: string;
  resumeName: string;
  reviewState: ReviewState;
  filled: boolean;
  answeredQuestions: AnsweredQuestion[];
}

const DEFAULT_ADAPTERS: ApplicationAdapter[] = DEFAULT_APPLICATION_ADAPTERS;

export function guardAgainstSubmit(page: Page): void {
  const originalClick = page.click.bind(page);
  page.click = async (selector: string, options?: Parameters<Page["click"]>[1]) => {
    if (isForbiddenSubmitName(selector)) {
      throw new ForbiddenActionError(selector);
    }
    return originalClick(selector, options);
  };
}

export async function prepareApplication(
  page: Page,
  profile: UserProfile,
  job: ExtractedJob,
  options: PrepareOptions = {},
): Promise<PrepareResult> {
  const env = getEnv();
  if (!env.PAUSE_BEFORE_SUBMIT) {
    logger.warn("PAUSE_BEFORE_SUBMIT is false, but JobPilot will still refuse to click Submit.");
  }

  guardAgainstSubmit(page);
  const adapter = routeApplicationAdapter(applyUrlOf(job), options.adapters ?? DEFAULT_ADAPTERS);
  const resume = options.resumeHint
    ? selectResume(profile, options.resumeHint)
    : selectResumeForJob(profile, `${job.title} ${job.description}`);
  logger.info(`Starting application preparation with ${adapter.name} adapter`);

  try {
    await adapter.openApplication(page, job);
    await adapter.fillProfile(page, profile);
    await adapter.uploadResume(page, resume).catch((error: unknown) => {
      const reason = error instanceof Error ? error.message : "Resume upload failed";
      logger.warn(reason);
    });
    const answeredQuestions = await adapter.answerQuestions(page, {
      job,
      profile,
      resume,
      provider: options.provider,
    });
    const reviewState = await adapter.detectReviewState(page);
    logger.info("Review state detected. Stopping before submit.");
    return {
      applicationUrl: page.url() || applyUrlOf(job),
      resumeName: resume.name,
      reviewState,
      filled: true,
      answeredQuestions,
    };
  } catch (error) {
    await captureFailureScreenshot(page, job.company).catch(() => undefined);
    throw error;
  }
}
