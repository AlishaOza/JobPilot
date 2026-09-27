import { describe, expect, it } from "vitest";
import { canonicalizeJobUrl, inferSource, jobIdentity, mergeExtractedJob, normalizeJobInput, normalizeUrl } from "../src/jobs/normalize-job";

describe("job normalization", () => {
  it("normalizes a valid job row", () => {
    const job = normalizeJobInput({
      company: "  Example Tech  ",
      role: "Frontend Developer",
      location: "Pune",
      jobUrl: "https://www.indeed.com/viewjob?jk=123",
      source: "",
    });
    expect(job.company).toBe("Example Tech");
    expect(job.source).toBe("Indeed");
  });

  it("rejects a missing URL", () => {
    expect(() => normalizeJobInput({ company: "A", role: "B", jobUrl: "", location: "", source: "" })).toThrow();
  });

  it("normalizes http URLs and rejects others", () => {
    expect(normalizeUrl("https://example.com/job")).toBe("https://example.com/job");
    expect(normalizeUrl("file:///C:/tmp/job.html")).toContain("file://");
    expect(() => normalizeUrl("notaurl")).toThrow(/Invalid URL/);
  });

  it("treats Indeed job keys as the same listing across hosts", () => {
    expect(jobIdentity("https://www.indeed.com/viewjob?jk=abc&from=search")).toBe("indeed:abc");
    expect(jobIdentity("https://in.indeed.com/viewjob?jk=abc&utm_source=x")).toBe("indeed:abc");
    expect(canonicalizeJobUrl("https://in.indeed.com/viewjob?jk=abc&utm_source=x")).toBe(
      "https://in.indeed.com/viewjob?jk=abc",
    );
  });

  it("infers portal sources", () => {
    expect(inferSource("https://www.naukri.com/job")).toBe("Naukri");
    expect(inferSource("https://internshala.com/job")).toBe("Internshala");
  });

  it("merges extracted fields over the Excel input", () => {
    const merged = mergeExtractedJob(
      {
        company: "Excel Co",
        role: "Excel Role",
        location: "Pune",
        jobUrl: "https://example.com/job",
        source: "Example",
      },
      { title: "Frontend Developer", description: "React TypeScript" },
    );
    expect(merged.title).toBe("Frontend Developer");
    expect(merged.company).toBe("Excel Co");
    expect(merged.originalUrl).toBe("https://example.com/job");
  });
});
