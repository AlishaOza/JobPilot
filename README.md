# JobPilot

Personal CLI job-search assistant. JobPilot discovers jobs from configured portals, skips stale postings, prepares applications with Playwright, and **stops before final submit**.

Gemini is used only for free-text application questions that cannot be filled from `profile.json`. JobPilot does not score jobs, recommend resumes with AI, or submit applications.

## Requirements

- Node.js 20+
- npm

## Installation

```bash
npm install
npx playwright install chromium
```

Copy environment defaults:

```bash
copy .env.example .env
```

On macOS/Linux use `cp .env.example .env`.

## Environment setup

Edit `.env`. Important values:

| Variable | Purpose |
|---|---|
| `AI_PROVIDER` | `gemini`, `openai`, or `heuristic` (offline) |
| `GEMINI_API_KEY` | Required for live Gemini answers |
| `AI_MODEL` | Defaults to `gemini-2.0-flash` |
| `MAX_JOB_AGE_DAYS` | Only process jobs this many days old. Default `21` |
| `JOB_SOURCES` | Comma-separated discovery adapters. Default `indeed` |
| `JOB_SOURCE_COUNTRY` | Indeed host country code. Default `in` |
| `DISCOVERY_ENABLED` | `true` to search portals on `jobs` / `daily` |
| `HEADLESS` | `false` recommended so you can complete login/OTP |
| `PAUSE_BEFORE_SUBMIT` | Always leave `true` |

Never commit `.env`. JobPilot never logs passwords, API keys, cookies, or storage state.

## Profile setup

Edit `data/profile.json`. This is the single source of truth for deterministic answers.

Known fields are filled directly:

- Name → `profile.name`
- Email → `profile.email`
- Phone → `profile.phone`
- Location → `profile.location`
- Experience → `profile.experienceMonths`
- Availability → `profile.availability`

Gemini is called only for questions like "Why do you want to join us?" or "Describe a project."

If a fact is missing — salary, visa, work authorization, legal declarations — JobPilot stores `NEEDS_USER_INPUT` and does not invent an answer.

## Excel format

### `data/jobs.xlsx` (discovery history)

You do not need to fill this file by hand. `npm run jobs` and `npm run daily` search configured portals using `profile.json` roles, locations, skills, and experience, then append fresh unique jobs here.

| Company | Role | Location | Job URL | Apply URL | Source | Posted | Posted At |
|---|---|---|---|---|---|---|---|

`Job URL` is the listing. `Apply URL` is the actual application destination and may be a different website (company ATS, careers page, or same-site apply). Discovery and apply are separate adapters.

### `data/applications.xlsx` (output)

Application ID, Company, Role, Location, Job URL, Application URL, Posted, Posting Status, Resume, Status, Manual Review, Missing Information, Answers, Created At, Submitted At, Follow Up Date, Notes.

The most important column is **Application URL**. Open it, review generated answers, and submit yourself.

### `data/contacts.xlsx` (output)

Company, Recruiter, Role, LinkedIn, Email, Phone, Status, Last Contacted, Follow Up Date, Notes.

Outreach drafts are also written to `reports/outreach.json`. These are drafts only and are never sent.

## Resume setup

Place your files here:

```
resumes/frontend.pdf
resumes/fullstack.pdf
```

The resume is chosen from job title/description keywords and resume tags. This is not an AI recommendation.

## Authentication / storageState

Portals may require email/password, OTP, CAPTCHA, or MFA. JobPilot does not bypass those.

First run:

1. Playwright opens the portal.
2. You log in manually if needed.
3. You complete OTP / CAPTCHA / MFA.
4. Session is saved to `storage/<portal>.json`.

Later runs reuse that file. `storage/` is gitignored.

If a challenge appears, JobPilot pauses and asks you to finish it.

## CLI commands

```bash
npm run jobs              # discover jobs from configured portals, then extract JDs
npm run analyze           # freshness check only (job-fit analysis was removed)
npm run prepare-apps      # fill forms; Gemini only for free-text questions; stop at review
                          # (named prepare-apps because npm reserves `prepare`)
npm run review            # write applications.xlsx + reports/review.json
npm run contacts          # recruiter LinkedIn/email/call drafts
npm run followups         # show follow-ups due today
npm run export            # refresh Excel reports
npm run mark-submitted -- <Application ID>
npm run daily             # jobs → prepare → review → contacts → follow-ups
```

Default flow:

`configured portals → search roles/locations/skills → keep jobs ≤ 21 days → drop duplicates → jobs.xlsx history → Playwright fills known fields → Gemini answers remaining free-text questions → stop at review → you submit`

Discovery is deterministic. It does not use AI to find or rank jobs.

`JobSourceAdapter` finds listings. After a job is found, JobPilot resolves the real Apply URL and routes it to an `ApplicationAdapter`. Indeed/LinkedIn/Naukri are not assumed to be the application site.

- Same-site apply → portal-specific adapter when one exists (Indeed today)
- External ATS / company site → generic application adapter
- Add more apply adapters without changing discovery sources

The first discovery source is Indeed; add more by implementing `JobSourceAdapter` and listing them in `JOB_SOURCES`.

Statuses include `FOUND`, `SKIPPED_OLD`, `POSTING_DATE_UNKNOWN`, `APPLICATION_STARTED`, `READY_FOR_REVIEW`, `SUBMITTED`.

- Older than 21 days → `SKIPPED_OLD`
- Date missing → `POSTING_DATE_UNKNOWN` and still prepared for manual review
- Individual failures → `FAILED`; the batch continues

## Testing

```bash
npm run typecheck
npm test
npm run lint
```

The Playwright tests use local HTML fixtures. The most important safety check: preparation ends at `READY_FOR_REVIEW` and never clicks Submit.

## Current MVP limitations

- No frontend and no database.
- One generic application adapter. Portal-specific apply adapters (Naukri, Internshala) are not implemented yet.
- Job discovery currently includes Indeed only. Other `JobSource` adapters can be added later.
- Without `GEMINI_API_KEY`, free-text answers use the offline heuristic provider.
- Forms that do not expose labels, file inputs, or standard review controls may need a dedicated adapter.
- Recruiter messages are drafts only. Nothing is sent.
- Final submit is never clicked, even if `PAUSE_BEFORE_SUBMIT` is changed.

## Safety rules

- Default mode is `PREPARE_ONLY`.
- Unknown or sensitive facts stay `NEEDS_USER_INPUT`.
- Gemini never invents experience, salary, visa status, or employers.
- Secrets stay out of logs and git.
- If a site blocks automation, stop and finish the step manually.
