import { z } from "zod";
import type { ExtractedJob } from "../jobs/job.types";
import { classifyQuestion, deterministicAnswer, type QuestionKind } from "../profile/deterministic-answers";
import type { UserProfile } from "../profile/profile.schema";
import { AnalysisError } from "../utils/errors";
import { withRetry } from "../utils/retry";
import type { AiProvider } from "./ai-provider";
import { buildQuestionAnswerPrompt } from "./prompts/question-answer";

export const questionAnswerSchema = z.object({
  answer: z.string().min(1),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  needsUserInput: z.boolean(),
});

export type QuestionAnswer = z.infer<typeof questionAnswerSchema>;

export interface AnsweredQuestion extends QuestionAnswer {
  question: string;
  source: "profile" | "gemini" | "needs_user_input";
  kind: QuestionKind;
}

export interface ResolveQuestionInput {
  profile: UserProfile;
  job: Pick<ExtractedJob, "company" | "title" | "description">;
  question: string;
  fieldType?: string;
}

export async function answerApplicationQuestion(
  provider: AiProvider,
  input: ResolveQuestionInput,
): Promise<QuestionAnswer> {
  const prompt = buildQuestionAnswerPrompt({
    company: input.job.company,
    role: input.job.title,
    jobDescription: input.job.description,
    question: input.question,
    profile: input.profile,
  });

  return withRetry(
    async () => {
      const raw = await provider.completeJson(prompt);
      const parsed = questionAnswerSchema.safeParse(raw);
      if (!parsed.success) {
        throw new AnalysisError("Gemini question answer failed schema validation");
      }
      if (parsed.data.needsUserInput) {
        return { ...parsed.data, answer: "NEEDS_USER_INPUT" };
      }
      return parsed.data;
    },
    { attempts: 2, label: "Gemini application question" },
  );
}

export async function resolveApplicationQuestion(
  provider: AiProvider | undefined,
  input: ResolveQuestionInput,
): Promise<AnsweredQuestion> {
  const kind = classifyQuestion(input.question, input.fieldType);

  if (kind === "DETERMINISTIC") {
    const answer = deterministicAnswer(input.profile, input.question);
    if (answer) {
      return { question: input.question, answer, confidence: "HIGH", needsUserInput: false, source: "profile", kind };
    }
    return {
      question: input.question,
      answer: "NEEDS_USER_INPUT",
      confidence: "LOW",
      needsUserInput: true,
      source: "needs_user_input",
      kind,
    };
  }

  if (kind === "SENSITIVE") {
    return {
      question: input.question,
      answer: "NEEDS_USER_INPUT",
      confidence: "LOW",
      needsUserInput: true,
      source: "needs_user_input",
      kind,
    };
  }

  if (!provider) {
    return {
      question: input.question,
      answer: "NEEDS_USER_INPUT",
      confidence: "LOW",
      needsUserInput: true,
      source: "needs_user_input",
      kind,
    };
  }

  const generated = await answerApplicationQuestion(provider, input);
  if (generated.needsUserInput || generated.answer === "NEEDS_USER_INPUT") {
    return {
      question: input.question,
      ...generated,
      answer: "NEEDS_USER_INPUT",
      needsUserInput: true,
      source: "needs_user_input",
      kind,
    };
  }
  return { question: input.question, ...generated, source: "gemini", kind };
}
