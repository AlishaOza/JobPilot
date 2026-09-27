import { describe, expect, it } from "vitest";
import { envSchema, loadEnv, resetEnvCache } from "../src/config/env";

describe("environment validation", () => {
  it("applies safe defaults", () => {
    const parsed = envSchema.parse({
      AI_PROVIDER: "",
      HEADLESS: "false",
      PAUSE_BEFORE_SUBMIT: "true",
    });
    expect(parsed.AI_PROVIDER).toBe("heuristic");
    expect(parsed.HEADLESS).toBe(false);
    expect(parsed.PAUSE_BEFORE_SUBMIT).toBe(true);
    expect(parsed.FOLLOW_UP_DAYS).toBe(7);
    expect(parsed.MAX_JOB_AGE_DAYS).toBe(21);
    expect(parsed.DISCOVERY_ENABLED).toBe(true);
    expect(parsed.JOB_SOURCES).toBe("indeed");
  });

  it("rejects an invalid AI provider", () => {
    expect(() => envSchema.parse({ AI_PROVIDER: "unknown" })).toThrow();
  });

  it("loads overrides through loadEnv", () => {
    resetEnvCache();
    const env = loadEnv({ AI_PROVIDER: "heuristic", HEADLESS: "true" });
    expect(env.AI_PROVIDER).toBe("heuristic");
    expect(env.HEADLESS).toBe(true);
  });
});
