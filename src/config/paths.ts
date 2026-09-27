import path from "node:path";
import { getEnv } from "./env";

export function resolveFromRoot(...segments: string[]): string {
  return path.resolve(process.cwd(), ...segments);
}

export function getPaths() {
  const env = getEnv();
  return {
    profile: resolveFromRoot(env.PROFILE_PATH),
    jobs: resolveFromRoot(env.JOBS_FILE),
    applications: resolveFromRoot(env.APPLICATIONS_FILE),
    contacts: resolveFromRoot(env.CONTACTS_FILE),
    state: resolveFromRoot(env.STATE_FILE),
    resumeFrontend: resolveFromRoot(env.RESUME_FRONTEND),
    resumeFullstack: resolveFromRoot(env.RESUME_FULLSTACK),
    storageDir: resolveFromRoot(env.STORAGE_DIR),
    screenshotsDir: resolveFromRoot(env.SCREENSHOTS_DIR),
    reportsDir: resolveFromRoot(env.REPORTS_DIR),
    discoveryHistory: resolveFromRoot(env.DISCOVERY_HISTORY_FILE),
    dataDir: resolveFromRoot("data"),
    resumesDir: resolveFromRoot("resumes"),
  };
}

export function storageStatePath(portal: string): string {
  return path.join(getPaths().storageDir, `${portal}.json`);
}
