import { describe, expect, it } from "vitest";
import { questionAnswerSchema, resolveApplicationQuestion } from "../src/ai/question-answer";
import { classifyQuestion } from "../src/profile/deterministic-answers";
import { TrackingAiProvider, sampleJob, testProfile } from "./helpers";

describe("application question answering", () => {
  it("does not call Gemini when the answer is deterministic", async () => {
    const provider = new TrackingAiProvider();
    const result = await resolveApplicationQuestion(provider, {
      profile: testProfile(),
      job: sampleJob("https://example.com/apply"),
      question: "Email",
      fieldType: "text",
    });
    expect(provider.calls).toHaveLength(0);
    expect(result.source).toBe("profile");
    expect(result.answer).toBe("candidate@example.com");
    expect(result.needsUserInput).toBe(false);
  });

  it("calls Gemini for an unknown free-text question", async () => {
    const provider = new TrackingAiProvider("Generated interest answer");
    const result = await resolveApplicationQuestion(provider, {
      profile: testProfile(),
      job: sampleJob("https://example.com/apply"),
      question: "Why do you want to join us?",
      fieldType: "textarea",
    });
    expect(provider.calls).toHaveLength(1);
    expect(result.source).toBe("gemini");
    expect(result.answer).toBe("Generated interest answer");
  });

  it("returns NEEDS_USER_INPUT for unknown sensitive information", async () => {
    const provider = new TrackingAiProvider();
    const result = await resolveApplicationQuestion(provider, {
      profile: testProfile(),
      job: sampleJob("https://example.com/apply"),
      question: "Expected salary",
      fieldType: "text",
    });
    expect(provider.calls).toHaveLength(0);
    expect(result.answer).toBe("NEEDS_USER_INPUT");
    expect(result.needsUserInput).toBe(true);
    expect(result.source).toBe("needs_user_input");
  });

  it("validates Gemini responses with Zod", () => {
    expect(
      questionAnswerSchema.parse({
        answer: "I enjoy Angular and React work from my profile.",
        confidence: "HIGH",
        needsUserInput: false,
      }).confidence,
    ).toBe("HIGH");
    expect(() => questionAnswerSchema.parse({ answer: "", confidence: "YES" })).toThrow();
  });

  it("classifies describe-your-experience as free text, not a profile field", () => {
    expect(classifyQuestion("Describe your Angular experience", "textarea")).toBe("FREE_TEXT");
    expect(classifyQuestion("Email")).toBe("DETERMINISTIC");
    expect(classifyQuestion("Work authorization")).toBe("SENSITIVE");
  });
});
