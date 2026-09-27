import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { IndeedApplicationAdapter } from "../src/automation/adapters/indeed-adapter";
import { GenericApplicationAdapter } from "../src/automation/adapters/generic-adapter";
import { routeApplicationAdapter } from "../src/automation/adapters/registry";
import {
  classifyApplyDestination,
  pickApplyDestination,
  resolveApplyDestination,
} from "../src/jobs/apply-destination";

describe("apply destination classification", () => {
  it("treats same-host apply URLs as same-site", () => {
    expect(
      classifyApplyDestination(
        "https://in.indeed.com/viewjob?jk=abc",
        "https://in.indeed.com/apply/abc",
      ),
    ).toBe("same_site");
  });

  it("treats local file listing and apply pages as same-site", () => {
    expect(
      classifyApplyDestination(
        "file:///C:/fixtures/listing-same-site.html",
        "file:///C:/fixtures/application-form.html",
      ),
    ).toBe("same_site");
  });

  it("treats a company ATS URL as external, even when the listing is on Indeed", () => {
    expect(
      classifyApplyDestination(
        "https://in.indeed.com/viewjob?jk=abc",
        "https://boards.greenhouse.io/acme/jobs/99",
      ),
    ).toBe("external");
  });

  it("prefers an external company apply link over a same-site apply link", () => {
    const picked = pickApplyDestination("https://www.linkedin.com/jobs/view/123", [
      { url: "https://www.linkedin.com/jobs/view/123/apply", label: "Easy Apply" },
      { url: "https://jobs.lever.co/acme/abc", label: "Apply on company website" },
    ]);
    expect(picked.applyUrl).toBe("https://jobs.lever.co/acme/abc");
    expect(picked.kind).toBe("external");
  });
});

describe("application adapter routing", () => {
  it("routes an Indeed apply URL to the Indeed application adapter", () => {
    const adapter = routeApplicationAdapter("https://in.indeed.com/viewjob?jk=abc");
    expect(adapter.name).toBe("indeed");
    expect(adapter).toBeInstanceOf(IndeedApplicationAdapter);
  });

  it("routes an external ATS URL to the generic adapter, not the listing portal", () => {
    const adapter = routeApplicationAdapter("https://boards.greenhouse.io/acme/jobs/99");
    expect(adapter.name).toBe("generic");
    expect(adapter).toBeInstanceOf(GenericApplicationAdapter);
    expect(new IndeedApplicationAdapter().canHandle("https://boards.greenhouse.io/acme/jobs/99")).toBe(false);
  });

  it("does not use the listing source to choose the apply adapter", () => {
    const naukriListingApply = routeApplicationAdapter("https://careers.example.com/jobs/frontend");
    expect(naukriListingApply.name).toBe("generic");
  });
});

describe("apply destination resolution", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("resolves an external company apply URL from a listing page", async () => {
    const fileUrl = pathToFileURL(path.resolve("tests/fixtures/listing-external.html")).href;
    await page.goto(fileUrl);
    const destination = await resolveApplyDestination(page, "https://in.indeed.com/viewjob?jk=abc");
    expect(destination.applyUrl).toContain("greenhouse.io");
    expect(destination.kind).toBe("external");
  });

  it("resolves a same-site apply URL from a listing page", async () => {
    const fileUrl = pathToFileURL(path.resolve("tests/fixtures/listing-same-site.html")).href;
    await page.goto(fileUrl);
    const destination = await resolveApplyDestination(page, fileUrl);
    expect(destination.applyUrl).toContain("application-form.html");
    expect(destination.kind).toBe("same_site");
  });
});
