import { describe, expect, it } from "vitest";
import { assertTransition, canTransition, isPreparableStatus } from "../src/state/application-state";
import { followUpDateFrom, pendingFollowUps } from "../src/followups/followup-manager";
import { sampleRecord } from "./helpers";

describe("application state transitions", () => {
  it("allows the core happy path without job analysis", () => {
    expect(canTransition("FOUND", "APPLICATION_STARTED")).toBe(true);
    expect(canTransition("POSTING_DATE_UNKNOWN", "APPLICATION_STARTED")).toBe(true);
    expect(canTransition("APPLICATION_STARTED", "READY_FOR_REVIEW")).toBe(true);
    expect(canTransition("READY_FOR_REVIEW", "SUBMITTED")).toBe(true);
    expect(canTransition("SUBMITTED", "FOLLOW_UP")).toBe(true);
    expect(canTransition("FOUND", "SKIPPED_OLD")).toBe(true);
  });

  it("blocks skipping review", () => {
    expect(canTransition("APPLICATION_STARTED", "SUBMITTED")).toBe(false);
    expect(() => assertTransition("APPLICATION_STARTED", "SUBMITTED")).toThrow(/Cannot transition/);
  });

  it("treats fresh and unknown-date jobs as preparable", () => {
    expect(isPreparableStatus("FOUND")).toBe(true);
    expect(isPreparableStatus("POSTING_DATE_UNKNOWN")).toBe(true);
    expect(isPreparableStatus("SKIPPED_OLD")).toBe(false);
  });

  it("lists due follow-ups", () => {
    const due = pendingFollowUps(
      [
        sampleRecord({ status: "SUBMITTED", followUpDate: "2026-09-01" }),
        sampleRecord({ id: "later", status: "SUBMITTED", followUpDate: "2026-12-01" }),
      ],
      new Date("2026-09-27"),
    );
    expect(due).toHaveLength(1);
    expect(followUpDateFrom(new Date("2026-09-27"), 7)).toBe("2026-10-04");
  });
});
