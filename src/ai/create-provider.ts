import { getEnv } from "../config/env";
import { logger } from "../utils/logger";
import type { AiProvider } from "./ai-provider";
import { GeminiProvider } from "./gemini-provider";
import { HeuristicAiProvider } from "./heuristic-provider";
import { OpenAiProvider } from "./openai-provider";

export function createAiProvider(overrides?: {
  provider?: "gemini" | "openai" | "heuristic";
  apiKey?: string;
  model?: string;
}): AiProvider {
  const env = getEnv();
  const provider = overrides?.provider ?? env.AI_PROVIDER;

  if (provider === "gemini") {
    const apiKey = overrides?.apiKey ?? env.GEMINI_API_KEY ?? env.AI_API_KEY;
    if (!apiKey) {
      logger.warn("GEMINI_API_KEY is missing. Falling back to heuristic answers.");
      return new HeuristicAiProvider();
    }
    return new GeminiProvider(apiKey, overrides?.model ?? env.AI_MODEL);
  }

  if (provider === "openai") {
    const apiKey = overrides?.apiKey ?? env.AI_API_KEY;
    if (!apiKey) {
      logger.warn("AI_API_KEY is missing. Falling back to heuristic answers.");
      return new HeuristicAiProvider();
    }
    return new OpenAiProvider(apiKey, overrides?.model ?? env.AI_MODEL);
  }

  return new HeuristicAiProvider();
}
