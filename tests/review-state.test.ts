import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { detectReviewState, isForbiddenSubmitName } from "../src/automation/review-state";
import type { Browser, Page } from "playwright";

describe("review-state detection", () => {
  let browser: Browser;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true });
    page = await browser.newPage();
  });

  afterAll(async () => {
    await browser?.close();
  });

  it("identifies forbidden submit names", () => {
    expect(isForbiddenSubmitName("Submit Application")).toBe(true);
    expect(isForbiddenSubmitName("Apply now")).toBe(true);
    expect(isForbiddenSubmitName("Save draft")).toBe(false);
  });

  it("detects a review page with a visible submit button", async () => {
    const fileUrl = pathToFileURL(path.resolve("tests/fixtures/application-form.html")).href;
    await page.goto(fileUrl);
    const state = await detectReviewState(page);
    expect(state.isReview).toBe(true);
    expect(state.submitVisible).toBe(true);
  });
});
