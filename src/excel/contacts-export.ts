import { getPaths } from "../config/paths";
import type { ContactRecord } from "../contacts/contact.types";
import { CONTACT_HEADERS, writeWorksheet } from "./writer";

export async function exportContacts(contacts: ContactRecord[], filePath?: string): Promise<string> {
  const target = filePath ?? getPaths().contacts;
  await writeWorksheet(
    target,
    "Contacts",
    [...CONTACT_HEADERS],
    contacts.map((contact) => ({
      Company: contact.company,
      Recruiter: contact.recruiter,
      Role: contact.role,
      LinkedIn: contact.linkedin,
      Email: contact.email,
      Phone: contact.phone,
      Status: contact.status,
      "Last Contacted": contact.lastContacted ?? "",
      "Follow Up Date": contact.followUpDate ?? "",
      Notes: contact.notes,
    })),
  );
  return target;
}
