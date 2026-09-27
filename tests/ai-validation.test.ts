import { describe, expect, it } from "vitest";
import { HeuristicAiProvider } from "../src/ai/heuristic-provider";
import { answerApplicationQuestion, questionAnswerSchema } from "../src/ai/question-answer";
import { testProfile } from "./helpers";

describe("Gemini question-answer validation", () => {
  it("accepts a valid question answer payload", () => {
    const parsed = questionAnswerSchema.parse({
      answer: "I want to join because the stack matches my Angular and React experience.",
      confidence: "MEDIUM",
      needsUserInput: false,
    });
    expect(parsed.needsUserInput).toBe(false);
  });

  it("rejects malformed AI output", () => {
    expect(() => questionAnswerSchema.parse({ answer: "", confidence: "MAYBE" })).toThrow();
  });

  it("returns structured answers from the heuristic provider", async () => {
    const result = await answerApplicationQuestion(new HeuristicAiProvider(), {
      profile: testProfile(),
      job: {
        company: "Example Tech",
        title: "Frontend Developer",
        description: "React TypeScript role",
      },
      question: "Why are you interested in this role?",
    });
    expect(result.answer.length).toBeGreaterThan(10);
    expect(result.needsUserInput).toBe(false);
  });
});
