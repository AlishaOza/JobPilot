import type { UserProfile } from "../../profile/profile.schema";

export function buildOutreachPrompt(profile: UserProfile, company: string, role: string, recruiter: string): string {
  return `Write three short drafts for a job seeker. Do not invent employers, years, or salary.
If a recruiter name is "Hiring Team", greet generally.

Return JSON:
{
  "linkedin": string,
  "email": string,
  "callScript": string
}

PROFILE:
name=${profile.name}
skills=${profile.skills.join(", ")}
availability=${profile.availability}
location=${profile.location}

TARGET:
company=${company}
role=${role}
recruiter=${recruiter}`;
}
