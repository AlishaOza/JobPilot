import { access } from "node:fs/promises";
import path from "node:path";
import type { Page } from "playwright";
import type { Resume } from "../profile/profile.schema";
import { AutomationError } from "../utils/errors";
import { logger } from "../utils/logger";

export async function uploadResume(page: Page, resume: Resume): Promise<boolean> {
  const resolved = path.resolve(process.cwd(), resume.path);
  try {
    await access(resolved);
  } catch {
    throw new AutomationError(`Resume file not found: ${resume.path}`, false);
  }

  const fileInput = page.locator('input[type="file"]').first();
  if ((await fileInput.count()) === 0) {
    logger.warn("No file input found for resume upload");
    return false;
  }

  await fileInput.setInputFiles(resolved);
  logger.info(`Resume uploaded: ${resume.name}`);
  return true;
}
