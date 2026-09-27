import { describe, expect, it } from "vitest";
import { evaluateFreshness, parsePostedDate } from "../src/jobs/posting-date";

const NOW = new Date("2026-09-27T12:00:00.000Z");

describe("job freshness", () => {
  it("parses relative posting phrases", () => {
    expect(parsePostedDate("Posted 5 hours ago", NOW)?.toISOString()).toBe("2026-09-27T07:00:00.000Z");
    expect(parsePostedDate("Posted 2 days ago", NOW)?.toISOString()).toBe("2026-09-25T12:00:00.000Z");
    expect(parsePostedDate("Posted 1 week ago", NOW)?.toISOString()).toBe("2026-09-20T12:00:00.000Z");
    expect(parsePostedDate("Posted 15 days ago", NOW)?.toISOString()).toBe("2026-09-12T12:00:00.000Z");
  });

  it("parses absolute posting dates", () => {
    const iso = parsePostedDate("2026-09-20", NOW);
    expect(iso).toBeTruthy();
    const named = parsePostedDate("Posted Sep 20, 2026", NOW);
    expect(named?.getFullYear()).toBe(2026);
    expect(named?.getMonth()).toBe(8);
    expect(named?.getDate()).toBe(20);
  });

  it("continues jobs posted within 21 days", () => {
    expect(evaluateFreshness("Posted 2 days ago", 21, NOW).status).toBe("FRESH");
    expect(evaluateFreshness("Posted 15 days ago", 21, NOW).status).toBe("FRESH");
    expect(evaluateFreshness("Posted 3 weeks ago", 21, NOW).status).toBe("FRESH");
  });

  it("skips jobs older than 21 days", () => {
    const result = evaluateFreshness("Posted 30 days ago", 21, NOW);
    expect(result.status).toBe("SKIPPED_OLD");
    expect(result.ageDays).toBe(30);
  });

  it("marks unknown posting dates for manual review", () => {
    const result = evaluateFreshness("date not listed", 21, NOW);
    expect(result.status).toBe("POSTING_DATE_UNKNOWN");
    expect(result.postedAt).toBeNull();
    expect(evaluateFreshness("", 21, NOW).status).toBe("POSTING_DATE_UNKNOWN");
  });
});
