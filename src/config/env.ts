import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv();

const emptyToUndefined = (value: unknown): unknown => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }
  return value;
};

const booleanFromEnv = z.preprocess((value) => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "string") {
    return ["true", "1", "yes"].includes(value.toLowerCase());
  }
  return false;
}, z.boolean());

export const envSchema = z.object({
  AI_PROVIDER: z.preprocess(emptyToUndefined, z.enum(["gemini", "openai", "heuristic"]).default("heuristic")),
  AI_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  GEMINI_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  AI_MODEL: z.preprocess(emptyToUndefined, z.string().default("gemini-2.0-flash")),
  USER_EMAIL: z.preprocess(emptyToUndefined, z.string().email().optional()),
  USER_PHONE: z.preprocess(emptyToUndefined, z.string().optional()),
  USER_LOCATION: z.preprocess(emptyToUndefined, z.string().optional()),
  USER_LINKEDIN: z.preprocess(emptyToUndefined, z.string().url().optional()),
  USER_GITHUB: z.preprocess(emptyToUndefined, z.string().url().optional()),
  USER_PORTFOLIO: z.preprocess(emptyToUndefined, z.string().url().optional()),
  INDEED_EMAIL: z.preprocess(emptyToUndefined, z.string().optional()),
  INDEED_PASSWORD: z.preprocess(emptyToUndefined, z.string().optional()),
  NAUKRI_EMAIL: z.preprocess(emptyToUndefined, z.string().optional()),
  NAUKRI_PASSWORD: z.preprocess(emptyToUndefined, z.string().optional()),
  INTERNSHALA_EMAIL: z.preprocess(emptyToUndefined, z.string().optional()),
  INTERNSHALA_PASSWORD: z.preprocess(emptyToUndefined, z.string().optional()),
  HEADLESS: booleanFromEnv.default(false),
  PAUSE_BEFORE_SUBMIT: booleanFromEnv.default(true),
  FOLLOW_UP_DAYS: z.preprocess(
    (value) => (value === undefined || value === "" ? 7 : Number(value)),
    z.number().int().min(1).max(60),
  ),
  MAX_JOB_AGE_DAYS: z.preprocess(
    (value) => (value === undefined || value === "" ? 21 : Number(value)),
    z.number().int().min(1).max(365),
  ),
  DISCOVERY_ENABLED: booleanFromEnv.default(true),
  JOB_SOURCES: z.preprocess(emptyToUndefined, z.string().default("indeed")),
  JOB_SOURCE_COUNTRY: z.preprocess(emptyToUndefined, z.string().default("in")),
  DISCOVERY_MAX_ROLES: z.preprocess(
    (value) => (value === undefined || value === "" ? 3 : Number(value)),
    z.number().int().min(1).max(10),
  ),
  DISCOVERY_MAX_LOCATIONS: z.preprocess(
    (value) => (value === undefined || value === "" ? 2 : Number(value)),
    z.number().int().min(1).max(8),
  ),
  DISCOVERY_MAX_SEARCHES: z.preprocess(
    (value) => (value === undefined || value === "" ? 6 : Number(value)),
    z.number().int().min(1).max(20),
  ),
  DISCOVERY_MAX_JOBS: z.preprocess(
    (value) => (value === undefined || value === "" ? 30 : Number(value)),
    z.number().int().min(1).max(200),
  ),
  DISCOVERY_HISTORY_FILE: z.preprocess(
    emptyToUndefined,
    z.string().default("./data/discovery-history.json"),
  ),
  PROFILE_PATH: z.preprocess(emptyToUndefined, z.string().default("./data/profile.json")),
  JOBS_FILE: z.preprocess(emptyToUndefined, z.string().default("./data/jobs.xlsx")),
  APPLICATIONS_FILE: z.preprocess(emptyToUndefined, z.string().default("./data/applications.xlsx")),
  CONTACTS_FILE: z.preprocess(emptyToUndefined, z.string().default("./data/contacts.xlsx")),
  STATE_FILE: z.preprocess(emptyToUndefined, z.string().default("./data/state.json")),
  RESUME_FRONTEND: z.preprocess(emptyToUndefined, z.string().default("./resumes/frontend.pdf")),
  RESUME_FULLSTACK: z.preprocess(emptyToUndefined, z.string().default("./resumes/fullstack.pdf")),
  STORAGE_DIR: z.preprocess(emptyToUndefined, z.string().default("./storage")),
  SCREENSHOTS_DIR: z.preprocess(emptyToUndefined, z.string().default("./screenshots")),
  REPORTS_DIR: z.preprocess(emptyToUndefined, z.string().default("./reports")),
});

export type AppEnv = z.infer<typeof envSchema>;

let cachedEnv: AppEnv | undefined;

export function loadEnv(overrides: Record<string, string | undefined> = {}): AppEnv {
  const parsed = envSchema.safeParse({ ...process.env, ...overrides });
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  cachedEnv = parsed.data;
  return parsed.data;
}

export function getEnv(): AppEnv {
  if (!cachedEnv) {
    return loadEnv();
  }
  return cachedEnv;
}

export function resetEnvCache(): void {
  cachedEnv = undefined;
}
