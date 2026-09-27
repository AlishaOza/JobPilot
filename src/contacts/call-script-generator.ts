import type { ContactRecord } from "./contact.types";

export function formatCallList(contacts: ContactRecord[]): string {
  if (contacts.length === 0) {
    return "TODAY'S CALLS\n\nNo contacts available. Run `npm run contacts` after analyzing jobs.";
  }

  const lines = ["TODAY'S CALLS", ""];
  contacts.forEach((contact, index) => {
    lines.push(`${index + 1}. ${contact.company}`);
    lines.push(`   Role: ${contact.role}`);
    lines.push(`   Recruiter: ${contact.recruiter}`);
    lines.push(`   Phone: ${contact.phone || "NEEDS_USER_INPUT"}`);
    lines.push(`   Status: ${contact.status}`);
    lines.push(`   Script:`);
    lines.push(`   "${contact.drafts?.callScript ?? "Hi, I'm calling about this role."}"`);
    lines.push("");
  });
  return lines.join("\n");
}
