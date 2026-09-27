import type { ApplicationStatus } from "../state/application-state";
import type { ApplyDestinationKind } from "./apply-destination";
import type { PostingStatus } from "./posting-date";

export interface JobInput {
  company: string;
  role: string;
  location: string;
  jobUrl: string;
  applyUrl?: string;
  source: string;
  posted?: string;
  postedAt?: string;
}

export interface ExtractedJob {
  company: string;
  title: string;
  location: string;
  description: string;
  salary: string | null;
  skills: string[];
  source: string;
  jobUrl: string;
  applyUrl: string;
  applicationUrl: string;
  originalUrl: string;
  postedText: string | null;
  postedAt: string | null;
  destinationKind: ApplyDestinationKind;
  postingStatus?: PostingStatus;
}

export interface Job extends ExtractedJob {
  id: string;
  status: ApplicationStatus;
  errorCode?: string;
  errorMessage?: string;
}
