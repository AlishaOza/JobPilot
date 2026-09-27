import { getPaths } from "../config/paths";
import type { ApplicationRecord } from "../state/state-store";
import { APPLICATION_HEADERS, writeWorksheet } from "./writer";

export function applicationToRow(record: ApplicationRecord): Record<string, string | number | boolean> {
  const answers = (record.answeredQuestions ?? [])
    .map((item) => `${item.question}: ${item.answer} [${item.source}]`)
    .join(" | ");
  return {
    "Application ID": record.id,
    Company: record.company,
    Role: record.role,
    Location: record.location,
    "Job URL": record.jobUrl,
    "Application URL": record.applyUrl || record.applicationUrl,
    Destination: record.destinationKind ?? "",
    Posted: record.postedText ?? record.postedAt ?? "",
    "Posting Status": record.postingStatus ?? "",
    Resume: record.resume,
    Status: record.status,
    "Manual Review": record.manualReview ? "YES" : "NO",
    "Missing Information": record.missingInformation.join("; "),
    Answers: answers,
    "Created At": record.createdAt,
    "Submitted At": record.submittedAt ?? "",
    "Follow Up Date": record.followUpDate ?? "",
    Notes: record.notes,
  };
}

export async function exportApplications(records: ApplicationRecord[], filePath?: string): Promise<string> {
  const target = filePath ?? getPaths().applications;
  await writeWorksheet(target, "Applications", [...APPLICATION_HEADERS], records.map(applicationToRow));
  return target;
}
