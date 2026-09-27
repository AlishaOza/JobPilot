import { GoogleGenerativeAI } from "@google/generative-ai";
import { AnalysisError } from "../utils/errors";
import type { AiProvider } from "./ai-provider";

export class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  private readonly client: GoogleGenerativeAI;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = model;
  }

  async completeJson(prompt: string): Promise<unknown> {
    const content = await this.complete(prompt, true);
    try {
      return JSON.parse(stripCodeFence(content));
    } catch {
      throw new AnalysisError("Gemini returned invalid JSON");
    }
  }

  async completeText(prompt: string): Promise<string> {
    return this.complete(prompt, false);
  }

  private async complete(prompt: string, json: boolean): Promise<string> {
    const model = this.client.getGenerativeModel({
      model: this.model,
      generationConfig: json ? { responseMimeType: "application/json", temperature: 0.2 } : { temperature: 0.2 },
    });
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${json ? "Return valid JSON only. " : ""}Never invent personal facts. Unknown values must be NEEDS_USER_INPUT.\n\n${prompt}`,
            },
          ],
        },
      ],
    });
    const content = result.response.text().trim();
    if (!content) {
      throw new AnalysisError("Gemini returned an empty response");
    }
    return content;
  }
}

function stripCodeFence(value: string): string {
  return value.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}
