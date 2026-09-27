import type { Page } from "playwright";
import type { AnsweredQuestion } from "../../ai/question-answer";
import type { ExtractedJob } from "../../jobs/job.types";
import type { Resume, UserProfile } from "../../profile/profile.schema";
import { fillProfileFields } from "../form-filler";
import { answerDetectedQuestions } from "../questions";
import { detectReviewState, type ReviewState } from "../review-state";
import { uploadResume } from "../resume-uploader";
import { applyUrlOf, type ApplicationAdapter, type ApplicationContext } from "./application-adapter";

export class GenericApplicationAdapter implements ApplicationAdapter {
  readonly name: string = "generic";

  canHandle(_applyUrl: string): boolean {
    return true;
  }

  async openApplication(page: Page, job: ExtractedJob): Promise<void> {
    await page.goto(applyUrlOf(job), { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => undefined);
  }

  async fillProfile(page: Page, profile: UserProfile): Promise<void> {
    await fillProfileFields(page, profile);
  }

  async uploadResume(page: Page, resume: Resume): Promise<void> {
    await uploadResume(page, resume);
  }

  async answerQuestions(page: Page, context: ApplicationContext): Promise<AnsweredQuestion[]> {
    return answerDetectedQuestions(page, context.profile, context.job, context.provider);
  }

  async detectReviewState(page: Page): Promise<ReviewState> {
    return detectReviewState(page);
  }
}
