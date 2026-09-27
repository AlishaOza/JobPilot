import { getEnv } from "../config/env";
import type { ApplicationRecord } from "../state/state-store";

export function followUpDateFrom(date = new Date(), days?: number): string {
  const offset = days ?? getEnv().FOLLOW_UP_DAYS;
  const next = new Date(date);
  next.setDate(next.getDate() + offset);
  return next.toISOString().slice(0, 10);
}

export function isDue(followUpDate: string | null, today = new Date()): boolean {
  if (!followUpDate) {
    return false;
  }
  return followUpDate.slice(0, 10) <= today.toISOString().slice(0, 10);
}

export function pendingFollowUps(records: ApplicationRecord[], today = new Date()): ApplicationRecord[] {
  return records.filter((record) => {
    if (!["SUBMITTED", "FOLLOW_UP"].includes(record.status)) {
      return false;
    }
    return isDue(record.followUpDate, today);
  });
}

export function formatFollowUps(records: ApplicationRecord[]): string {
  if (records.length === 0) {
    return "No follow-ups due today.";
  }
  return records
    .map((record, index) => {
      return `${index + 1}. ${record.company} — ${record.role}\n   Status: ${record.status}\n   Follow up: ${record.followUpDate}\n   URL: ${record.applicationUrl || record.jobUrl}`;
    })
    .join("\n\n");
}
