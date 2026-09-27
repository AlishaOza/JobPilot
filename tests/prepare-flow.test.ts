import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium, type Browser, type Page } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prepareApplication } from "../src/automation/application-runner";
import { assertTransition } from "../src/state/application-state";
import { TrackingAiProvider, loadTestEnv, sampleJob, testProfile, withTempDir } from "./helpers";

describe("application preparation flow", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    const dir = await withTempDir();
    loadTestEnv(dir);
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("fills deterministic fields without calling Gemini and never clicks Submit", async () => {
    const provider = new TrackingAiProvider();
    const fileUrl = pathToFileURL(path.resolve("tests/fixtures/application-form.html")).href;
    const result = await prepareApplication(page, testProfile(), sampleJob(fileUrl), { resumeHint: "frontend", provider });

    expect(result.filled).toBe(true);
    expect(result.resumeName).toBe("Frontend Resume");
    expect(result.reviewState.submitVisible).toBe(true);
    expect(provider.calls).toHaveLength(0);
    expect(await page.locator('input[name="name"]').inputValue()).toBe("Test Candidate");
    expect(await page.locator('input[name="email"]').inputValue()).toBe("candidate@example.com");
    expect(await page.evaluate("document.body.dataset.submitted")).toBeUndefined();

    let status: "APPLICATION_STARTED" | "READY_FOR_REVIEW" = "APPLICATION_STARTED";
    assertTransition(status, "READY_FOR_REVIEW");
    status = "READY_FOR_REVIEW";
    expect(status).toBe("READY_FOR_REVIEW");
    expect(() => assertTransition("APPLICATION_STARTED", "SUBMITTED")).toThrow();
  });

  it("inserts a Gemini answer into a free-text question and leaves salary for the user", async () => {
    const provider = new TrackingAiProvider("I want to join because the role uses React from my profile.");
    const fileUrl = pathToFileURL(path.resolve("tests/fixtures/application-form-questions.html")).href;
    const result = await prepareApplication(page, testProfile(), sampleJob(fileUrl), { provider });

    expect(provider.calls.length).toBeGreaterThan(0);
    expect(await page.locator("textarea[name='why']").inputValue()).toContain("React");
    expect(await page.locator('input[name="salary"]').inputValue()).toBe("");
    expect(result.answeredQuestions.some((item) => item.source === "gemini")).toBe(true);
    expect(result.answeredQuestions.some((item) => item.question.toLowerCase().includes("salary") && item.needsUserInput)).toBe(true);
    expect(await page.evaluate("document.body.dataset.submitted")).toBeUndefined();
  });
});
