import type { UserProfile } from "../../profile/profile.schema";

export interface QuestionAnswerPromptInput {
  company: string;
  role: string;
  jobDescription: string;
  question: string;
  profile: UserProfile;
}

export function buildQuestionAnswerPrompt(input: QuestionAnswerPromptInput): string {
  return `APPLICATION_QUESTION_JSON
You are helping a candidate answer one job-application question.

Use ONLY these facts:
- the candidate profile
- the current job description
- the current question

Never invent experience, skills, companies, education, salary, certifications, visa status, or other personal information.
If the answer is not supported by the provided facts, set needsUserInput to true and answer to NEEDS_USER_INPUT.
Keep the answer concise and natural. Do not mention that you are an AI.

Return JSON only:
{
  "answer": "...",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "needsUserInput": false
}

COMPANY: ${input.company}
ROLE: ${input.role}

PROFILE:
${JSON.stringify(
    {
      name: input.profile.name,
      location: input.profile.location,
      experienceMonths: input.profile.experienceMonths,
      availability: input.profile.availability,
      skills: input.profile.skills,
      education: input.profile.education,
      resumes: input.profile.resumes.map((resume) => ({ name: resume.name, tags: resume.tags })),
    },
    null,
    2,
  )}

JOB DESCRIPTION:
${input.jobDescription.slice(0, 6_000)}

QUESTION:
${input.question}`;
}
