import { z } from "zod";
import type { UserProfile } from "../profile/profile.schema";
import type { AiProvider } from "./ai-provider";
import { buildOutreachPrompt } from "./prompts/messages";

export const outreachSchema = z.object({
  linkedin: z.string().min(1),
  email: z.string().min(1),
  callScript: z.string().min(1),
});

export type OutreachDrafts = z.infer<typeof outreachSchema>;

export async function generateOutreachDrafts(
  provider: AiProvider,
  profile: UserProfile,
  company: string,
  role: string,
  recruiter = "Hiring Team",
): Promise<OutreachDrafts> {
  const raw = await provider.completeJson(buildOutreachPrompt(profile, company, role, recruiter));
  const parsed = outreachSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      linkedin: `Hi, I came across the ${role} opening at ${company}. I have hands-on experience with Angular, React, TypeScript and full-stack development and am available for immediate joining. I'd love to connect and discuss the opportunity.`,
      email: `Hello,\n\nI am interested in the ${role} role at ${company} and am available to join immediately. I would welcome a conversation about the opportunity.\n\nThank you.`,
      callScript: `Hi, I'm calling about the ${role} opening at ${company}. I wanted to introduce myself and ask about next steps.`,
    };
  }
  return parsed.data;
}
