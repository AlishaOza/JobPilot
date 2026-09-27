import type { UserProfile } from "./profile.schema";

export type QuestionKind = "DETERMINISTIC" | "FREE_TEXT" | "SENSITIVE";

const SENSITIVE_PATTERN =
  /salary|ctc|compensation|visa|authorization|sponsor|relocat|legal declaration|gender|race|disability|criminal|ethnicity|religion/i;

const FREE_TEXT_PATTERN =
  /why (do you|are you)|describe|tell us|tell me|project you|cover letter|motivation|about yourself|what interests you|why this role|why (this )?compan/i;

const DETERMINISTIC_FIELDS: Array<{ pattern: RegExp; value: (profile: UserProfile) => string }> = [
  { pattern: /full name|^name$|candidate name/i, value: (profile) => profile.name },
  { pattern: /e-?mail/i, value: (profile) => profile.email },
  { pattern: /phone|mobile|contact number/i, value: (profile) => profile.phone },
  { pattern: /location|city|current location/i, value: (profile) => profile.location },
  { pattern: /^(total )?experience$|years of experience|experience in (years|months)|total exp/i, value: (profile) => formatExperience(profile.experienceMonths) },
  { pattern: /availability|notice|immediate joiner/i, value: (profile) => profile.availability },
  { pattern: /linkedin/i, value: (profile) => profile.links.linkedin },
  { pattern: /github/i, value: (profile) => profile.links.github },
  { pattern: /portfolio|website/i, value: (profile) => profile.links.portfolio },
  { pattern: /degree|qualification/i, value: (profile) => profile.education.degree },
  { pattern: /college|university/i, value: (profile) => profile.education.college },
];

export function formatExperience(months: number): string {
  if (months < 12) {
    return `${months} months`;
  }
  const years = Math.floor(months / 12);
  const remaining = months % 12;
  if (remaining === 0) {
    return `${years} year${years === 1 ? "" : "s"}`;
  }
  return `${years} year${years === 1 ? "" : "s"} ${remaining} months`;
}

export function classifyQuestion(question: string, fieldType?: string): QuestionKind {
  if (SENSITIVE_PATTERN.test(question)) {
    return "SENSITIVE";
  }
  if (fieldType === "textarea" || FREE_TEXT_PATTERN.test(question)) {
    return "FREE_TEXT";
  }
  if (DETERMINISTIC_FIELDS.some((field) => field.pattern.test(question))) {
    return "DETERMINISTIC";
  }
  return "SENSITIVE";
}

export function deterministicAnswer(profile: UserProfile, question: string): string | undefined {
  const match = DETERMINISTIC_FIELDS.find((field) => field.pattern.test(question));
  const value = match?.value(profile).trim();
  return value || undefined;
}

export function selectResumeForJob(
  profile: UserProfile,
  jobText: string,
): UserProfile["resumes"][number] {
  const haystack = jobText.toLowerCase();
  if (/full.?stack|node\.?js|mongodb|backend/.test(haystack)) {
    const fullstack = profile.resumes.find((resume) => resume.tags.some((tag) => /fullstack|node|mongo/.test(tag)));
    if (fullstack) {
      return fullstack;
    }
  }
  if (/front|angular|react|ui/.test(haystack)) {
    const frontend = profile.resumes.find((resume) => resume.tags.some((tag) => /frontend|angular|react/.test(tag)));
    if (frontend) {
      return frontend;
    }
  }
  return profile.resumes[0];
}
