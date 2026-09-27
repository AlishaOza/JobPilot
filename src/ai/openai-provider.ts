import OpenAI from "openai";
import { AnalysisError } from "../utils/errors";
import type { AiProvider } from "./ai-provider";

export class OpenAiProvider implements AiProvider {
  readonly name = "openai";
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async completeJson(prompt: string): Promise<unknown> {
    const content = await this.complete(prompt, true);
    try {
      return JSON.parse(content);
    } catch {
      throw new AnalysisError("AI returned invalid JSON");
    }
  }

  async completeText(prompt: string): Promise<string> {
    return this.complete(prompt, false);
  }

  private async complete(prompt: string, json: boolean): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0.1,
      response_format: json ? { type: "json_object" } : undefined,
      messages: [
        {
          role: "system",
          content: "You are a careful job-search assistant. Never invent facts. Unknown values must be NEEDS_USER_INPUT.",
        },
        { role: "user", content: prompt },
      ],
    });

    const content = response.choices[0]?.message?.content?.trim();
    if (!content) {
      throw new AnalysisError("AI returned an empty response");
    }
    return content;
  }
}
