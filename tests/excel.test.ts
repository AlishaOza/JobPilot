import path from "node:path";
import { describe, expect, it } from "vitest";
import { exportApplications } from "../src/excel/applications-export";
import { readWorksheetRows } from "../src/excel/reader";
import { writeJobsWorkbook } from "../src/excel/jobs-export";
import { APPLICATION_HEADERS } from "../src/excel/writer";
import { readJobs } from "../src/jobs/read-jobs";
import { sampleRecord, withTempDir } from "./helpers";

describe("Excel parsing and export", () => {
  it("parses jobs.xlsx rows", async () => {
    const dir = await withTempDir();
    const filePath = path.join(dir, "jobs.xlsx");
    await writeJobsWorkbook(
      [
        {
          company: "Example Tech",
          role: "Frontend Developer",
          location: "Pune",
          jobUrl: "https://example.com/jobs/frontend",
          source: "Example",
        },
      ],
      filePath,
    );

    const rows = await readWorksheetRows(filePath, ["Company", "Role", "Location", "Job URL", "Source"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.Company).toBe("Example Tech");
    expect(await readJobs(filePath)).toEqual([
      {
        company: "Example Tech",
        role: "Frontend Developer",
        location: "Pune",
        jobUrl: "https://example.com/jobs/frontend",
        source: "Example",
      },
    ]);
  });

  it("exports applications.xlsx with required columns", async () => {
    const dir = await withTempDir();
    const filePath = path.join(dir, "applications.xlsx");
    await exportApplications([sampleRecord({ status: "READY_FOR_REVIEW" })], filePath);
    const rows = await readWorksheetRows(filePath, [...APPLICATION_HEADERS]);
    expect(rows[0]?.["Application ID"]).toBe("JP-test-1");
    expect(rows[0]?.Status).toBe("READY_FOR_REVIEW");
    expect(rows[0]?.["Posting Status"]).toBe("FRESH");
    expect(rows[0]?.["Manual Review"]).toBe("NO");
  });
});
