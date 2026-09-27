import { describe, expect, it } from "vitest";
import { redactSecrets } from "../src/utils/logger";

describe("secret redaction", () => {
  it("redacts API keys and passwords", () => {
    expect(redactSecrets("using sk-abcdefghijklmnopqrstuvwxyz and password=hunter2")).toContain("[REDACTED]");
    expect(redactSecrets("using sk-abcdefghijklmnopqrstuvwxyz")).not.toContain("sk-abcdefghijklmnopqrstuvwxyz");
    expect(redactSecrets("Authorization: Bearer abc.def.ghi")).toContain("[REDACTED]");
  });
});
