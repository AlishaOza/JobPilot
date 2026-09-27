import { readFile } from "node:fs/promises";
import { getEnv } from "../config/env";
import { getPaths } from "../config/paths";
import { ValidationError } from "../utils/errors";
import { profileSchema, type UserProfile } from "./profile.schema";

export async function loadProfile(filePath?: string): Promise<UserProfile> {
  const path = filePath ?? getPaths().profile;
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch {
    throw new ValidationError(`Profile file not found: ${path}`);
  }

  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new ValidationError("profile.json is not valid JSON");
  }

  const parsed = profileSchema.safeParse(data);
  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
    throw new ValidationError(`Invalid profile: ${details}`);
  }

  return mergeEnvOverrides(parsed.data);
}

function mergeEnvOverrides(profile: UserProfile): UserProfile {
  const env = getEnv();
  return {
    ...profile,
    email: env.USER_EMAIL ?? profile.email,
    phone: env.USER_PHONE ?? profile.phone,
    location: env.USER_LOCATION ?? profile.location,
    links: {
      linkedin: env.USER_LINKEDIN ?? profile.links.linkedin,
      github: env.USER_GITHUB ?? profile.links.github,
      portfolio: env.USER_PORTFOLIO ?? profile.links.portfolio,
    },
  };
}

export function selectResume(profile: UserProfile, recommended: string): UserProfile["resumes"][number] {
  const needle = recommended.toLowerCase();
  const tagged = profile.resumes.find((resume) =>
    resume.tags.some((tag) => needle.includes(tag.toLowerCase()) || tag.toLowerCase().includes(needle)),
  );
  if (tagged) {
    return tagged;
  }
  const named = profile.resumes.find((resume) => resume.name.toLowerCase().includes(needle));
  return named ?? profile.resumes[0];
}
