import { z } from "zod";

export const resumeSchema = z.object({
  name: z.string().min(1),
  path: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
});

export const educationSchema = z.object({
  degree: z.string().min(1),
  college: z.string().min(1),
});

export const linksSchema = z.object({
  linkedin: z.string().url().or(z.literal("")),
  github: z.string().url().or(z.literal("")),
  portfolio: z.string().url().or(z.literal("")),
});

export const preferencesSchema = z.object({
  roles: z.array(z.string()).default([]),
  locations: z.array(z.string()).default([]),
  workModes: z.array(z.string()).default([]),
  experienceBand: z.string().default("0-2 years"),
});

export const profileSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  location: z.string().min(1),
  experienceMonths: z.number().int().nonnegative(),
  availability: z.string().min(1),
  skills: z.array(z.string().min(1)).min(1),
  education: educationSchema,
  links: linksSchema,
  resumes: z.array(resumeSchema).min(1),
  preferences: preferencesSchema.default({
    roles: [],
    locations: [],
    workModes: [],
    experienceBand: "0-2 years",
  }),
});

export type Resume = z.infer<typeof resumeSchema>;
export type UserProfile = z.infer<typeof profileSchema>;
