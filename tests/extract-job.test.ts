import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { extractJobFromPage } from "../src/jobs/extract-job";

describe("job extraction", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("extracts title, company, location, and description from a local job page", async () => {
    const fileUrl = pathToFileURL(path.resolve("tests/fixtures/job-page.html")).href;
    await page.goto(fileUrl);
    const job = await extractJobFromPage(
      page,
      {
        company: "Fallback Co",
        role: "Fallback Role",
        location: "Unknown",
        jobUrl: fileUrl,
        source: "Fixture",
      },
      ["React", "TypeScript", "Node.js"],
    );

    expect(job.title).toContain("Frontend Developer");
    expect(job.company).toContain("Example Tech");
    expect(job.location).toContain("Pune");
    expect(job.description).toContain("React");
    expect(job.skills).toEqual(expect.arrayContaining(["React", "TypeScript"]));
    expect(job.applyUrl).toContain("application-form.html");
    expect(job.applicationUrl).toContain("application-form.html");
    expect(job.jobUrl).toBe(fileUrl);
    expect(job.destinationKind).toBe("same_site");
    expect(job.postedText).toBeTruthy();
  });
});
