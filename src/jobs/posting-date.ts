import { getEnv } from "../config/env";

export type PostingStatus = "FRESH" | "SKIPPED_OLD" | "POSTING_DATE_UNKNOWN";

export interface PostingFreshness {
  status: PostingStatus;
  postedAt: Date | null;
  postedText: string | null;
  ageDays: number | null;
}

const MS_PER_DAY = 86_400_000;

export function parsePostedDate(text: string | null | undefined, now = new Date()): Date | null {
  const raw = (text ?? "").replace(/\s+/g, " ").trim();
  if (!raw) {
    return null;
  }

  const relative = parseRelative(raw, now);
  if (relative) {
    return relative;
  }

  const cleaned = raw.replace(/^posted\s*:?\s*/i, "").trim();
  const absolute = Date.parse(cleaned);
  if (!Number.isNaN(absolute)) {
    return new Date(absolute);
  }

  return null;
}

function parseRelative(text: string, now: Date): Date | null {
  const lower = text.toLowerCase();
  if (/just now|a moment ago|\btoday\b/.test(lower)) {
    return new Date(now);
  }
  if (/\byesterday\b/.test(lower)) {
    return new Date(now.getTime() - MS_PER_DAY);
  }

  const match = lower.match(/(\d+)\s*(minute|hour|day|week|month)s?\s*ago/);
  if (!match) {
    return null;
  }
  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers: Record<string, number> = {
    minute: MS_PER_DAY / 24 / 60,
    hour: MS_PER_DAY / 24,
    day: MS_PER_DAY,
    week: 7 * MS_PER_DAY,
    month: 30 * MS_PER_DAY,
  };
  const delta = multipliers[unit ?? ""];
  if (!delta) {
    return null;
  }
  return new Date(now.getTime() - amount * delta);
}

export function ageInDays(postedAt: Date, now = new Date()): number {
  return Math.floor((now.getTime() - postedAt.getTime()) / MS_PER_DAY);
}

export function evaluateFreshness(
  text: string | null | undefined,
  maxAgeDays = getEnv().MAX_JOB_AGE_DAYS,
  now = new Date(),
): PostingFreshness {
  const postedText = (text ?? "").replace(/\s+/g, " ").trim() || null;
  const postedAt = parsePostedDate(postedText, now);
  if (!postedAt) {
    return { status: "POSTING_DATE_UNKNOWN", postedAt: null, postedText, ageDays: null };
  }
  const days = ageInDays(postedAt, now);
  return {
    status: days <= maxAgeDays ? "FRESH" : "SKIPPED_OLD",
    postedAt,
    postedText,
    ageDays: days,
  };
}
