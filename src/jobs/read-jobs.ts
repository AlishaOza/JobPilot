import { getPaths } from "../config/paths";
import { readWorksheetRows } from "../excel/reader";
import { logger } from "../utils/logger";
import { normalizeJobInput } from "./normalize-job";
import type { JobInput } from "./job.types";

export async function readJobs(filePath?: string): Promise<JobInput[]> {
  const target = filePath ?? getPaths().jobs;
  logger.info(`Reading ${target}`);
  const rows = await readWorksheetRows(target, ["Company", "Role", "Location", "Job URL", "Source"]);
  const jobs: JobInput[] = [];

  for (const [index, row] of rows.entries()) {
    try {
      jobs.push(
        normalizeJobInput({
          company: row.Company,
          role: row.Role,
          location: row.Location,
          jobUrl: row["Job URL"],
          applyUrl: row["Apply URL"],
          source: row.Source,
          posted: row.Posted,
          postedAt: row["Posted At"],
        }),
      );
    } catch (error) {
      const reason = error instanceof Error ? error.message : "Unknown validation error";
      logger.error(`Skipping jobs.xlsx row ${index + 2}: ${reason}`);
    }
  }

  logger.info(`Found ${jobs.length} jobs`);
  return jobs;
}
