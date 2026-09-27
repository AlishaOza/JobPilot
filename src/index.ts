import { loadEnv } from "./config/env";
import { ensureDataFiles } from "./excel/templates";
import {
  runAnalyzeCommand,
  runContactsCommand,
  runDailyCommand,
  runExportCommand,
  runFollowupsCommand,
  runJobsCommand,
  runMarkSubmittedCommand,
  runPrepareCommand,
  runReviewCommand,
} from "./pipeline";
import { logger } from "./utils/logger";

const COMMANDS = [
  "jobs",
  "analyze",
  "prepare",
  "review",
  "contacts",
  "followups",
  "export",
  "mark-submitted",
  "daily",
] as const;

type Command = (typeof COMMANDS)[number];

function printHelp(): void {
  console.log(`JobPilot — prepare applications, never auto-submit.

Commands:
  npm run jobs             Discover fresh jobs from configured portals, then extract JDs
  npm run analyze          Freshness check only (job-fit analysis was removed)
  npm run prepare-apps     Fill forms, ask Gemini only for free-text questions, stop at review
  npm run review           Write applications.xlsx and a JSON review report
  npm run contacts         Generate recruiter message/email/call drafts
  npm run followups        Show follow-ups due today
  npm run export           Refresh Excel reports
  npm run mark-submitted -- <id>
  npm run daily            Run the composed daily workflow
`);
}

async function main(): Promise<void> {
  loadEnv();
  await ensureDataFiles();
  const command = (process.argv[2] ?? "").toLowerCase();
  if (!command || command === "help" || command === "--help") {
    printHelp();
    return;
  }

  if (!COMMANDS.includes(command as Command)) {
    logger.error(`Unknown command: ${command}`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  try {
    switch (command as Command) {
      case "jobs":
        await runJobsCommand();
        break;
      case "analyze":
        await runAnalyzeCommand();
        break;
      case "prepare":
        await runPrepareCommand();
        break;
      case "review":
        await runReviewCommand();
        break;
      case "contacts":
        await runContactsCommand();
        break;
      case "followups":
        await runFollowupsCommand();
        break;
      case "export":
        await runExportCommand();
        break;
      case "mark-submitted":
        await runMarkSubmittedCommand(process.argv[3]);
        break;
      case "daily":
        await runDailyCommand();
        break;
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Unknown error";
    logger.error(reason);
    process.exitCode = 1;
  }
}

void main();
