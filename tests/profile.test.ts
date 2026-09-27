import { writeFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadProfile, selectResume } from "../src/profile/profile";
import { profileSchema } from "../src/profile/profile.schema";
import { loadTestEnv, testProfile, withTempDir, writeTempProfile } from "./helpers";

describe("profile validation", () => {
  it("accepts a complete profile", () => {
    expect(profileSchema.parse(testProfile()).email).toBe("candidate@example.com");
  });

  it("rejects a missing email", () => {
    expect(() => profileSchema.parse({ ...testProfile(), email: "not-an-email" })).toThrow();
  });

  it("loads profile.json from disk", async () => {
    const dir = await withTempDir();
    loadTestEnv(dir);
    const filePath = await writeTempProfile(dir);
    const profile = await loadProfile(filePath);
    expect(profile.name).toBe("Test Candidate");
  });

  it("rejects invalid JSON", async () => {
    const dir = await withTempDir();
    const filePath = path.join(dir, "bad.json");
    await writeFile(filePath, "{bad", "utf8");
    await expect(loadProfile(filePath)).rejects.toThrow(/valid JSON/);
  });

  it("selects a resume from tags", () => {
    const resume = selectResume(testProfile(), "fullstack");
    expect(resume.name).toBe("Full Stack Resume");
  });
});
