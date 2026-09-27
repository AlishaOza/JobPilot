import { generateOutreachDrafts } from "../ai/message-generator";
import { createAiProvider } from "../ai/create-provider";
import type { UserProfile } from "../profile/profile.schema";
import type { ApplicationRecord } from "../state/state-store";
import type { ContactRecord } from "./contact.types";

export async function buildContactsFromApplications(
  profile: UserProfile,
  applications: ApplicationRecord[],
  existing: ContactRecord[] = [],
): Promise<ContactRecord[]> {
  const provider = createAiProvider();
  const relevant = applications.filter((app) =>
    ["READY_FOR_REVIEW", "SUBMITTED", "FOLLOW_UP", "APPLICATION_STARTED"].includes(app.status),
  );
  const contacts: ContactRecord[] = [];

  for (const app of relevant) {
    const previous = existing.find((item) => item.company === app.company && item.role === app.role);
    const drafts = await generateOutreachDrafts(provider, profile, app.company, app.role, previous?.recruiter ?? "Hiring Team");
    contacts.push({
      company: app.company,
      recruiter: previous?.recruiter ?? "Hiring Team",
      role: app.role,
      linkedin: previous?.linkedin ?? profile.links.linkedin,
      email: previous?.email ?? "",
      phone: previous?.phone ?? "",
      status: previous?.status ?? "NOT_CONTACTED",
      lastContacted: previous?.lastContacted ?? null,
      followUpDate: previous?.followUpDate ?? app.followUpDate,
      notes: "Drafts only. Do not send automatically.",
      drafts,
    });
  }

  return contacts;
}
