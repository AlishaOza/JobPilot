import { ValidationError } from "../utils/errors";
import { classifyApplyDestination } from "./apply-destination";
import type { ExtractedJob, JobInput } from "./job.types";

const URL_PATTERN = /^(https?:|file:)\/\//i;

export function normalizeText(value: unknown): string {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeUrl(value: unknown): string {
  const text = normalizeText(value);
  if (!text) {
    return "";
  }
  if (!URL_PATTERN.test(text)) {
    throw new ValidationError(`Invalid URL: ${text}`);
  }
  return text;
}

export function normalizeJobInput(row: Partial<JobInput>): JobInput {
  const jobUrl = normalizeUrl(row.jobUrl);
  const company = normalizeText(row.company);
  const role = normalizeText(row.role);
  if (!jobUrl) {
    throw new ValidationError("Job URL is required");
  }
  if (!company) {
    throw new ValidationError("Company is required");
  }
  if (!role) {
    throw new ValidationError("Role is required");
  }

  const posted = normalizeText(row.posted);
  const postedAt = normalizeText(row.postedAt);
  const applyUrl = normalizeText(row.applyUrl);
  return {
    company,
    role,
    location: normalizeText(row.location) || "Unknown",
    jobUrl,
    source: normalizeText(row.source) || inferSource(jobUrl),
    ...(applyUrl ? { applyUrl } : {}),
    ...(posted ? { posted } : {}),
    ...(postedAt ? { postedAt } : {}),
  };
}

export function canonicalizeJobUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const jk = parsed.searchParams.get("jk") ?? parsed.searchParams.get("vjk");
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (jk && host.includes("indeed")) {
      return `${parsed.protocol}//${host}/viewjob?jk=${jk}`;
    }
    const tracking = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "from", "tk", "fccid", "vjs"];
    for (const key of tracking) {
      parsed.searchParams.delete(key);
    }
    parsed.hash = "";
    parsed.hostname = host;
    return parsed.toString();
  } catch {
    return normalizeText(url);
  }
}

export function jobIdentity(url: string): string {
  try {
    const parsed = new URL(url);
    const jk = parsed.searchParams.get("jk") ?? parsed.searchParams.get("vjk");
    if (jk && parsed.hostname.toLowerCase().includes("indeed")) {
      return `indeed:${jk}`;
    }
  } catch {
    // Use the canonical string below.
  }
  return canonicalizeJobUrl(url);
}

export function inferSource(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (host.includes("indeed")) return "Indeed";
    if (host.includes("naukri")) return "Naukri";
    if (host.includes("internshala")) return "Internshala";
    if (host.includes("linkedin")) return "LinkedIn";
    return host;
  } catch {
    return "Unknown";
  }
}

export function mergeExtractedJob(input: JobInput, extracted: Partial<ExtractedJob>): ExtractedJob {
  const jobUrl = extracted.jobUrl ? normalizeUrl(extracted.jobUrl) : input.jobUrl;
  const applyUrl = extracted.applyUrl
    ? normalizeUrl(extracted.applyUrl)
    : extracted.applicationUrl
      ? normalizeUrl(extracted.applicationUrl)
      : input.applyUrl
        ? normalizeUrl(input.applyUrl)
        : jobUrl;
  const postedText = normalizeText(extracted.postedText) || input.posted || null;
  const postedAt = normalizeText(extracted.postedAt) || input.postedAt || null;
  return {
    company: normalizeText(extracted.company) || input.company,
    title: normalizeText(extracted.title) || input.role,
    location: normalizeText(extracted.location) || input.location,
    description: normalizeText(extracted.description),
    salary: normalizeText(extracted.salary) || null,
    skills: (extracted.skills ?? []).map(normalizeText).filter(Boolean),
    source: normalizeText(extracted.source) || input.source,
    jobUrl,
    applyUrl,
    applicationUrl: applyUrl,
    originalUrl: jobUrl,
    postedText,
    postedAt,
    destinationKind: extracted.destinationKind ?? classifyApplyDestination(jobUrl, applyUrl),
  };
}

export function extractSkillHints(description: string, knownSkills: string[] = []): string[] {
  const lower = description.toLowerCase();
  const found = new Set<string>();
  for (const skill of knownSkills) {
    if (lower.includes(skill.toLowerCase())) {
      found.add(skill);
    }
  }
  return [...found];
}
