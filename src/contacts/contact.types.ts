export const CONTACT_STATUSES = [
  "NOT_CONTACTED",
  "CALLED",
  "NO_RESPONSE",
  "CONNECTED",
  "FOLLOW_UP",
  "COMPLETED",
] as const;

export type ContactStatus = (typeof CONTACT_STATUSES)[number];

export interface ContactRecord {
  company: string;
  recruiter: string;
  role: string;
  linkedin: string;
  email: string;
  phone: string;
  status: ContactStatus;
  lastContacted: string | null;
  followUpDate: string | null;
  notes: string;
  drafts?: {
    linkedin: string;
    email: string;
    callScript: string;
  };
}
