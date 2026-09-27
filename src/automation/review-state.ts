import type { Page } from "playwright";

export interface ReviewState {
  isReview: boolean;
  submitVisible: boolean;
  missingFields: string[];
  reason: string;
}

export const FORBIDDEN_SUBMIT_NAMES = [
  /submit application/i,
  /submit your application/i,
  /^submit$/i,
  /final submit/i,
  /confirm application/i,
  /^apply$/i,
  /apply now/i,
  /send application/i,
];

export async function detectReviewState(page: Page): Promise<ReviewState> {
  const submit = page.getByRole("button", { name: /submit|apply now|send application|confirm application/i });
  const reviewText = page.getByText(/review (your )?application|preview|ready to submit/i);
  const required = page.locator("[required], [aria-invalid='true']");
  const submitVisible = (await submit.count()) > 0 && (await submit.first().isVisible().catch(() => false));
  const isReview = submitVisible || (await reviewText.count()) > 0;
  const missingFields: string[] = [];

  const requiredCount = await required.count();
  for (let i = 0; i < requiredCount; i += 1) {
    const field = required.nth(i);
    const value = await field.inputValue().catch(() => "");
    if (!value) {
      const label = (await field.getAttribute("aria-label")) || (await field.getAttribute("name")) || `field-${i + 1}`;
      missingFields.push(label);
    }
  }

  return {
    isReview,
    submitVisible,
    missingFields,
    reason: isReview ? "Review or submit controls are visible" : "No review/submit controls detected",
  };
}

export function isForbiddenSubmitName(name: string): boolean {
  return FORBIDDEN_SUBMIT_NAMES.some((pattern) => pattern.test(name.trim()));
}
