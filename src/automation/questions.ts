import type { Page } from "playwright";
import type { AnsweredQuestion } from "../ai/question-answer";
import { resolveApplicationQuestion } from "../ai/question-answer";
import type { AiProvider } from "../ai/ai-provider";
import type { ExtractedJob } from "../jobs/job.types";
import type { UserProfile } from "../profile/profile.schema";
import { logger } from "../utils/logger";
import { fillDetectedQuestion } from "./form-filler";

export type DetectedFieldType = "text" | "textarea" | "select" | "radio" | "checkbox" | "file";

export interface DetectedQuestion {
  question: string;
  type: DetectedFieldType;
  name?: string;
}

interface RawField {
  question: string;
  type: DetectedFieldType;
  name?: string;
}

export async function detectApplicationQuestions(page: Page): Promise<DetectedQuestion[]> {
  const raw = (await page.evaluate(`(() => {
    const fields = [];
    const seen = new Set();
    const labelFor = (input) => {
      if (input.getAttribute("aria-label")) return input.getAttribute("aria-label") || "";
      const labelled = input.labels && input.labels[0];
      if (labelled) {
        const clone = labelled.cloneNode(true);
        clone.querySelectorAll("input, textarea, select, button").forEach((node) => node.remove());
        const text = (clone.textContent || "").replace(/\\s+/g, " ").trim();
        if (text) return text;
      }
      const parent = input.closest("label");
      if (parent) {
        const clone = parent.cloneNode(true);
        clone.querySelectorAll("input, textarea, select, button").forEach((node) => node.remove());
        const text = (clone.textContent || "").replace(/\\s+/g, " ").trim();
        if (text) return text;
      }
      return input.getAttribute("placeholder") || input.getAttribute("name") || "";
    };
    const controls = Array.from(document.querySelectorAll("input, textarea, select"));
    for (const input of controls) {
      const inputType = input.type ? String(input.type).toLowerCase() : String(input.tagName).toLowerCase();
      if (["hidden", "submit", "button", "image", "reset"].includes(inputType)) continue;
      let type = "text";
      if (String(input.tagName).toLowerCase() === "textarea") type = "textarea";
      else if (String(input.tagName).toLowerCase() === "select") type = "select";
      else if (inputType === "file") type = "file";
      else if (inputType === "radio") type = "radio";
      else if (inputType === "checkbox") type = "checkbox";
      const question = String(labelFor(input) || "").trim();
      if (!question) continue;
      const key = type + ":" + question + ":" + (input.getAttribute("name") || "");
      if (seen.has(key)) continue;
      seen.add(key);
      fields.push({ question, type, name: input.getAttribute("name") || undefined });
    }
    return fields;
  })()`)) as RawField[];

  return raw.filter((field) => field.type !== "file");
}

export async function answerDetectedQuestions(
  page: Page,
  profile: UserProfile,
  job: ExtractedJob,
  provider?: AiProvider,
): Promise<AnsweredQuestion[]> {
  const questions = await detectApplicationQuestions(page);
  const answered: AnsweredQuestion[] = [];

  for (const field of questions) {
    const result = await resolveApplicationQuestion(provider, {
      profile,
      job,
      question: field.question,
      fieldType: field.type,
    });
    answered.push(result);
    if (result.needsUserInput || result.answer === "NEEDS_USER_INPUT") {
      logger.info(`Marked NEEDS_USER_INPUT: ${field.question}`);
      continue;
    }
    const filled = await fillDetectedQuestion(page, field, result.answer);
    if (filled) {
      logger.info(`Filled question from ${result.source}: ${field.question}`);
    }
  }

  return answered;
}
