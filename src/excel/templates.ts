import { access, mkdir, writeFile } from "node:fs/promises";
import { getPaths } from "../config/paths";
import { CONTACT_HEADERS, JOB_HEADERS, writeWorksheet } from "./writer";

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDataFiles(): Promise<void> {
  const paths = getPaths();
  await mkdir(paths.dataDir, { recursive: true });
  await mkdir(paths.resumesDir, { recursive: true });
  await mkdir(paths.storageDir, { recursive: true });
  await mkdir(paths.screenshotsDir, { recursive: true });
  await mkdir(paths.reportsDir, { recursive: true });

  if (!(await exists(paths.jobs))) {
    await writeWorksheet(paths.jobs, "Jobs", [...JOB_HEADERS], []);
  }

  if (!(await exists(paths.applications))) {
    await writeWorksheet(paths.applications, "Applications", [], []);
  }

  if (!(await exists(paths.contacts))) {
    await writeWorksheet(paths.contacts, "Contacts", [...CONTACT_HEADERS], []);
  }

  if (!(await exists(paths.profile))) {
    await writeFile(paths.profile, `${JSON.stringify(defaultProfile(), null, 2)}\n`, "utf8");
  }
}

export function defaultProfile() {
  return {
    name: "Your Name",
    email: "you@example.com",
    phone: "+91-0000000000",
    location: "Pune",
    experienceMonths: 10,
    availability: "Immediate",
    skills: ["Angular", "React", "TypeScript", "JavaScript", "Node.js", "MongoDB", "REST APIs", "Playwright"],
    education: {
      degree: "Your Degree",
      college: "Your College",
    },
    links: {
      linkedin: "https://linkedin.com/in/your-profile",
      github: "https://github.com/your-handle",
      portfolio: "https://your-portfolio.example",
    },
    resumes: [
      {
        name: "Frontend Resume",
        path: "./resumes/frontend.pdf",
        tags: ["frontend", "angular", "react"],
      },
      {
        name: "Full Stack Resume",
        path: "./resumes/fullstack.pdf",
        tags: ["fullstack", "node", "mongodb"],
      },
    ],
    preferences: {
      roles: ["Software Developer", "Frontend Developer", "Full-Stack Developer"],
      locations: ["Pune", "Remote", "India"],
      workModes: ["Remote", "Hybrid", "Onsite"],
      experienceBand: "0-2 years",
    },
  };
}
