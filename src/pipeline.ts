import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createAiProvider } from "./ai/create-provider";
import { closeSession, launchSession } from "./automation/browser";
import { openAuthenticatedSession } from "./automation/authentication";
import { prepareApplication } from "./automation/application-runner";
import { getEnv } from "./config/env";
import { indeedHost } from "./discovery/adapters/indeed-source";
import { newJobsToProcess, runDiscovery, type JobSource } from "./discovery/discover";
import { loadDiscoveryHistory } from "./discovery/history";
import { getPaths } from "./config/paths";
import { formatCallList } from "./contacts/call-script-generator";
import { buildContactsFromApplications } from "./contacts/message-generator";
import { exportApplications } from "./excel/applications-export";
import { exportContacts } from "./excel/contacts-export";
import { ensureDataFiles } from "./excel/templates";
import { followUpDateFrom, formatFollowUps, pendingFollowUps } from "./followups/followup-manager";
import { extractJobFromPage } from "./jobs/extract-job";
import { evaluateFreshness } from "./jobs/posting-date";
import { readJobs } from "./jobs/read-jobs";
import { loadProfile } from "./profile/profile";
import { isPreparableStatus } from "./state/application-state";
import {
  createApplicationId,
  findByJobUrl,
  loadState,
  saveState,
  transitionApplication,
  upsertApplication,
  type ApplicationRecord,
} from "./state/state-store";
import { logger } from "./utils/logger";

function nowIso(): string {
  return new Date().toISOString();
}

function newRecord(
  partial: Partial<ApplicationRecord> &
    Pick<ApplicationRecord, "id" | "company" | "role" | "location" | "jobUrl" | "status">,
): ApplicationRecord {
  const timestamp = nowIso();
  return {
    id: partial.id,
    company: partial.company,
    role: partial.role,
    location: partial.location,
    jobUrl: partial.jobUrl,
    applyUrl: partial.applyUrl ?? partial.applicationUrl ?? partial.jobUrl,
    applicationUrl: partial.applicationUrl ?? partial.applyUrl ?? partial.jobUrl,
    destinationKind: partial.destinationKind ?? null,
    source: partial.source ?? "",
    description: partial.description ?? "",
    salary: partial.salary ?? null,
    skills: partial.skills ?? [],
    resume: partial.resume ?? "",
    status: partial.status,
    postingStatus: partial.postingStatus ?? null,
    postedAt: partial.postedAt ?? null,
    postedText: partial.postedText ?? null,
    manualReview: partial.manualReview ?? false,
    missingInformation: partial.missingInformation ?? [],
    answeredQuestions: partial.answeredQuestions ?? [],
    notes: partial.notes ?? "",
    errorCode: partial.errorCode,
    errorMessage: partial.errorMessage,
    createdAt: partial.createdAt ?? timestamp,
    updatedAt: partial.updatedAt ?? timestamp,
    submittedAt: partial.submittedAt ?? null,
    followUpDate: partial.followUpDate ?? null,
  };
}

function applyFreshness(record: ApplicationRecord): ApplicationRecord {
  const freshness = evaluateFreshness(record.postedText);
  const postedAt = freshness.postedAt?.toISOString() ?? null;
  if (freshness.status === "SKIPPED_OLD") {
    return {
      ...record,
      postingStatus: "SKIPPED_OLD",
      postedAt,
      postedText: freshness.postedText,
      status: "SKIPPED_OLD",
      notes: `Skipped: posted ${freshness.ageDays} day(s) ago (max ${getEnv().MAX_JOB_AGE_DAYS}).`,
      updatedAt: nowIso(),
    };
  }
  if (freshness.status === "POSTING_DATE_UNKNOWN") {
    return {
      ...record,
      postingStatus: "POSTING_DATE_UNKNOWN",
      postedAt,
      postedText: freshness.postedText,
      status: "POSTING_DATE_UNKNOWN",
      manualReview: true,
      notes: "Posting date unknown. Included for manual review.",
      updatedAt: nowIso(),
    };
  }
  return {
    ...record,
    postingStatus: "FRESH",
    postedAt,
    postedText: freshness.postedText,
    status: "FOUND",
    notes: `Fresh posting (${freshness.ageDays} day(s) old).`,
    updatedAt: nowIso(),
  };
}

export async function runJobsCommand(sources?: JobSource[]): Promise<ApplicationRecord[]> {
  await ensureDataFiles();
  const profile = await loadProfile();
  const state = await loadState();
  const existingJobs = await readJobs().catch(() => []);
  const history = await loadDiscoveryHistory();
  const env = getEnv();
  const portalHome = `${indeedHost(env.JOB_SOURCE_COUNTRY)}/`;
  const session = await openAuthenticatedSession(portalHome, { headless: env.HEADLESS });

  try {
    let jobs = existingJobs;
    if (env.DISCOVERY_ENABLED) {
      jobs = await runDiscovery(session.page, profile, existingJobs, state.applications, history, sources);
    } else {
      logger.info("Discovery disabled. Using jobs.xlsx only.");
    }

    const toProcess = newJobsToProcess(jobs, state.applications);
    logger.info(`Processing ${toProcess.length} job(s)`);

    for (const job of toProcess) {
      const existing = findByJobUrl(state, job.jobUrl);
      if (existing && !["FAILED", "FOUND", "POSTING_DATE_UNKNOWN"].includes(existing.status) && existing.description) {
        logger.info(`Skipping already processed job at ${job.company}`);
        continue;
      }
      logger.info(`Processing ${job.company}`);
      const id = existing?.id ?? createApplicationId(job.jobUrl);
      let record = existing ?? newRecord({
        id,
        company: job.company,
        role: job.role,
        location: job.location,
        jobUrl: job.jobUrl,
        applyUrl: job.applyUrl ?? job.jobUrl,
        applicationUrl: job.applyUrl ?? job.jobUrl,
        source: job.source,
        postedText: job.posted ?? job.postedAt ?? null,
        postedAt: job.postedAt ?? null,
        status: "FOUND",
      });
      try {
        await session.page.goto(job.jobUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
        const extracted = await extractJobFromPage(session.page, job, profile.skills);
        record = applyFreshness({
          ...record,
          company: extracted.company,
          role: extracted.title,
          location: extracted.location,
          description: extracted.description,
          salary: extracted.salary,
          skills: extracted.skills,
          applyUrl: extracted.applyUrl,
          applicationUrl: extracted.applyUrl,
          destinationKind: extracted.destinationKind,
          source: extracted.source,
          postedText: extracted.postedText,
          postedAt: extracted.postedAt,
          errorCode: undefined,
          errorMessage: undefined,
        });
        logger.info(`Posting status: ${record.postingStatus ?? "unknown"}`);
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Unknown extraction error";
        logger.error(`Job processing failed for ${job.company}`);
        logger.error(`Reason: ${reason}`);
        record = {
          ...record,
          status: "FAILED",
          errorCode: "EXTRACTION_FAILED",
          errorMessage: reason,
          notes: "Extraction failed. The rest of the batch continued.",
          updatedAt: nowIso(),
        };
      }
      upsertApplication(state, record);
      await saveState(state);
    }
  } finally {
    await closeSession(session);
  }

  await exportApplications(state.applications);
  return state.applications;
}

export async function runAnalyzeCommand(): Promise<ApplicationRecord[]> {
  await ensureDataFiles();
  logger.warn("AI job analysis was removed. Checking posting freshness only.");
  const state = await loadState();
  const targets = state.applications.filter((item) => ["FOUND", "FAILED", "POSTING_DATE_UNKNOWN"].includes(item.status));

  if (targets.length === 0) {
    logger.warn("No jobs available for a freshness check. Run `npm run jobs` first.");
    return state.applications;
  }

  for (const record of targets) {
    if (!record.postedText && !record.description) {
      continue;
    }
    const current = applyFreshness({
      ...record,
      postedText: record.postedText || record.description,
    });
    upsertApplication(state, current);
    logger.info(`${current.company} marked ${current.status}`);
  }

  await saveState(state);
  await exportApplications(state.applications);
  return state.applications;
}

export async function runPrepareCommand(): Promise<ApplicationRecord[]> {
  await ensureDataFiles();
  const profile = await loadProfile();
  const provider = createAiProvider();
  const state = await loadState();
  const targets = state.applications.filter((item) => isPreparableStatus(item.status) && item.postingStatus !== "SKIPPED_OLD");

  if (targets.length === 0) {
    logger.warn("No fresh jobs to prepare. Run `npm run jobs` first.");
    return state.applications;
  }

  const session = await launchSession({ headless: getEnv().HEADLESS });
  try {
    for (const record of targets) {
      let current = transitionApplication(record, "APPLICATION_STARTED");
      upsertApplication(state, current);
      await saveState(state);
      try {
        logger.info("Starting application preparation");
        const result = await prepareApplication(
          session.page,
          profile,
          {
            company: record.company,
            title: record.role,
            location: record.location,
            description: record.description,
            salary: record.salary,
            skills: record.skills,
            source: record.source,
            applyUrl: record.applyUrl || record.applicationUrl,
            applicationUrl: record.applyUrl || record.applicationUrl,
            jobUrl: record.jobUrl,
            originalUrl: record.jobUrl,
            postedText: record.postedText,
            postedAt: record.postedAt,
            destinationKind: record.destinationKind ?? "unknown",
          },
          { provider },
        );
        const missing = result.answeredQuestions.filter((item) => item.needsUserInput).map((item) => item.question);
        current = transitionApplication(current, "READY_FOR_REVIEW", {
          applyUrl: result.applicationUrl,
          applicationUrl: result.applicationUrl,
          resume: result.resumeName,
          answeredQuestions: result.answeredQuestions,
          manualReview: missing.length > 0 || current.manualReview || result.reviewState.missingFields.length > 0,
          missingInformation: [...new Set([...current.missingInformation, ...missing, ...result.reviewState.missingFields])],
          notes: "Prepared in PREPARE_ONLY mode. User must submit manually.",
        });
        logger.info("Review state detected");
        logger.info("Application saved as READY_FOR_REVIEW");
      } catch (error) {
        const reason = error instanceof Error ? error.message : "Preparation failed";
        logger.error(`Application preparation failed for ${record.company}`);
        logger.error(`Reason: ${reason}`);
        current = { ...current, status: "FAILED", errorCode: "AUTOMATION_FAILED", errorMessage: reason, updatedAt: nowIso() };
      }
      upsertApplication(state, current);
      await saveState(state);
    }
  } finally {
    await closeSession(session);
  }

  await exportApplications(state.applications);
  return state.applications;
}

export async function runReviewCommand(): Promise<string> {
  await ensureDataFiles();
  const state = await loadState();
  const target = await exportApplications(state.applications);
  const reportPath = path.join(getPaths().reportsDir, "review.json");
  await writeFile(reportPath, JSON.stringify(state.applications, null, 2), "utf8");
  logger.info(`Review Excel written to ${target}`);
  logger.info(`JSON report written to ${reportPath}`);
  return target;
}

export async function runContactsCommand(): Promise<void> {
  await ensureDataFiles();
  const profile = await loadProfile();
  const state = await loadState();
  const contacts = await buildContactsFromApplications(profile, state.applications);
  const excelPath = await exportContacts(contacts);
  const reportPath = path.join(getPaths().reportsDir, "outreach.json");
  const callListPath = path.join(getPaths().reportsDir, "call-list.md");
  await writeFile(reportPath, JSON.stringify(contacts, null, 2), "utf8");
  await writeFile(callListPath, formatCallList(contacts), "utf8");
  logger.info(`Contacts Excel written to ${excelPath}`);
  logger.info(`Drafts written to ${reportPath}`);
  console.log(formatCallList(contacts));
}

export async function runFollowupsCommand(): Promise<void> {
  await ensureDataFiles();
  const state = await loadState();
  const due = pendingFollowUps(state.applications);
  const text = formatFollowUps(due);
  const reportPath = path.join(getPaths().reportsDir, "followups.md");
  await writeFile(reportPath, `${text}\n`, "utf8");
  console.log(text);
}

export async function runExportCommand(): Promise<void> {
  await ensureDataFiles();
  const state = await loadState();
  await exportApplications(state.applications);
  logger.info("Excel reports generated");
}

export async function runMarkSubmittedCommand(applicationId?: string): Promise<void> {
  await ensureDataFiles();
  const state = await loadState();
  const ready = state.applications.filter((item) => item.status === "READY_FOR_REVIEW");
  if (!applicationId) {
    if (ready.length === 0) {
      logger.warn("No applications in READY_FOR_REVIEW. Nothing to mark submitted.");
      return;
    }
    logger.info("Applications ready for manual submit:");
    for (const item of ready) {
      logger.info(`${item.id} — ${item.company} — ${item.role}`);
    }
    logger.info("Run: npm run mark-submitted -- <Application ID>");
    return;
  }

  const record = state.applications.find((item) => item.id === applicationId);
  if (!record) {
    logger.error(`Application not found: ${applicationId}`);
    return;
  }
  const submitted = transitionApplication(record, "SUBMITTED", {
    submittedAt: nowIso(),
    followUpDate: followUpDateFrom(),
    notes: "User confirmed manual submission.",
  });
  upsertApplication(state, submitted);
  await saveState(state);
  await exportApplications(state.applications);
  logger.info(`${applicationId} marked SUBMITTED. Follow-up scheduled for ${submitted.followUpDate}.`);
}

export async function runDailyCommand(): Promise<void> {
  logger.info("Starting daily workflow");
  await runJobsCommand();
  await runPrepareCommand();
  await runReviewCommand();
  await runContactsCommand();
  await runFollowupsCommand();
  await runExportCommand();
  logger.info("Daily workflow complete");
}
