import { getPaths } from "../config/paths";
import type { JobInput } from "../jobs/job.types";
import { JOB_HEADERS, writeWorksheet } from "./writer";

export async function writeJobsWorkbook(jobs: JobInput[], filePath?: string): Promise<void> {
  const target = filePath ?? getPaths().jobs;
  await writeWorksheet(
    target,
    "Jobs",
    [...JOB_HEADERS],
    jobs.map((job) => ({
      Company: job.company,
      Role: job.role,
      Location: job.location,
      "Job URL": job.jobUrl,
      "Apply URL": job.applyUrl ?? "",
      Source: job.source,
      Posted: job.posted ?? "",
      "Posted At": job.postedAt ?? "",
    })),
  );
}
