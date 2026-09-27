import { StateTransitionError } from "../utils/errors";

export const APPLICATION_STATUSES = [
  "FOUND",
  "ANALYZING",
  "ANALYZED",
  "RELEVANT",
  "SKIPPED",
  "SKIPPED_OLD",
  "POSTING_DATE_UNKNOWN",
  "APPLICATION_STARTED",
  "READY_FOR_REVIEW",
  "SUBMITTED",
  "FOLLOW_UP",
  "INTERVIEW",
  "CLOSED",
  "FAILED",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const ALLOWED_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  FOUND: ["APPLICATION_STARTED", "SKIPPED", "SKIPPED_OLD", "POSTING_DATE_UNKNOWN", "ANALYZING", "FAILED"],
  ANALYZING: ["ANALYZED", "FAILED"],
  ANALYZED: ["RELEVANT", "SKIPPED", "FAILED"],
  RELEVANT: ["APPLICATION_STARTED", "SKIPPED", "FAILED"],
  SKIPPED: ["FOUND"],
  SKIPPED_OLD: ["FOUND"],
  POSTING_DATE_UNKNOWN: ["APPLICATION_STARTED", "SKIPPED", "FAILED"],
  APPLICATION_STARTED: ["READY_FOR_REVIEW", "FAILED"],
  READY_FOR_REVIEW: ["SUBMITTED", "FAILED"],
  SUBMITTED: ["FOLLOW_UP", "INTERVIEW", "CLOSED"],
  FOLLOW_UP: ["INTERVIEW", "CLOSED", "FOLLOW_UP"],
  INTERVIEW: ["CLOSED", "FOLLOW_UP"],
  CLOSED: [],
  FAILED: ["FOUND", "ANALYZING", "APPLICATION_STARTED"],
};

export function canTransition(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ApplicationStatus, to: ApplicationStatus): void {
  if (from === to) {
    return;
  }
  if (!canTransition(from, to)) {
    throw new StateTransitionError(from, to);
  }
}

export function isPreparableStatus(status: ApplicationStatus): boolean {
  return status === "FOUND" || status === "POSTING_DATE_UNKNOWN" || status === "RELEVANT";
}
