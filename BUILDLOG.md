# BUILDLOG.md — Development History & Antigravity Assistance Log

This document provides a detailed, chronological record of the build process across all stages of the **Job Application Truth Tracker**, documenting design decisions, issues identified during development, and the fixes applied.

---

## Stage-by-Stage Breakdown

### Stage 1: Planning, Design Document, Database Schema & Seed Data
- **What Was Built**:
  - `DESIGN.md`: Documented the problem statement, 10x claim, data model sketch, API surface, layered ASCII architecture, and non-goals (no scraping, no auto-apply, no browser automation).
  - `migrations/001_init.sql`: DDL defining `users`, `resumes`, `applications`, `llm_analyses`, and `weekly_reports` with native PostgreSQL 15 UUID keys, foreign key cascades, and 6 specialized indexes.
  - `src/db.js`: PostgreSQL connection pool wrapper using `pg.Pool`.
  - `migrate.js` & `seed.js`: Migration runner and demo data seed script (1 user, 3 resume variants, 9 applications with realistic statuses/dates, and 3 cached LLM analyses).
- **Issue Encountered & Fix**:
  - *Issue*: On initial database connection test, `database "job_tracker" does not exist` was returned because Postgres was running on the default `postgres` catalog.
  - *Fix*: Created the `job_tracker` database dynamically and verified connectivity with `process.env.DATABASE_URL`.

---

### Stage 2: JWT Authentication & User Repository
- **What Was Built**:
  - `src/middleware/auth.js`: Bearer JWT token verification middleware injecting `req.userId`.
  - `src/repositories/userRepository.js`: `getUserById`, `getUserByEmail`, `createUser`.
  - `src/routes/auth.js`: `POST /auth/register`, `POST /auth/login`, `GET /auth/me` with Zod validation and bcrypt password hashing.
  - `src/index.js`: Express application entrypoint.
  - `tests/auth.test.js`: 11 integration tests covering registration, duplicate email handling (409), password checks (401), and protected route validation.
- **Issue Encountered & Fix**:
  - *Issue*: In Zod v4, error objects use `.issues` rather than `.errors`. Accessing `parseResult.error.errors.map` returned `undefined` during validation failure tests.
  - *Fix*: Updated the error mapping to `(parseResult.error.issues || parseResult.error.errors || []).map(...)`, ensuring backward and forward compatibility.

---

### Stage 3: Resumes & Applications User-Scoped CRUD
- **What Was Built**:
  - `src/repositories/resumeRepository.js`: User-scoped CRUD for resume variants.
  - `src/repositories/applicationRepository.js`: User-scoped CRUD with dynamic SQL filtering (`?status=`, `?platform=`, `?resume_id=`) and pagination (`limit`/`offset`).
  - `src/routes/resumes.js` & `src/routes/applications.js`: Protected route handlers.
  - `tests/resumeApplication.test.js`: 18 tests verifying tenant isolation, cross-user 404 security barriers, foreign key ownership checks (400 if using another user's resume), and query filters.

---

### Stage 4: LLM Fit Analysis with SHA-256 Caching & Retry Mechanism
- **What Was Built**:
  - `src/services/hashService.js`: `hashText(text)` calculating SHA-256 hex digest of normalized job descriptions.
  - `src/repositories/analysisRepository.js`: Database queries for `llm_analyses`.
  - `src/services/analysisService.js`: Cache lookup by hash $\to$ Gemini API invocation on cache miss $\to$ Zod response validation $\to$ automatic retry on malformed JSON $\to$ database caching.
  - `src/routes/analyze.js`: `POST /applications/:id/analyze` returning `{ cached: true|false, fit_score, mismatch_reasons }`.
  - `tests/analysis.test.js`: Mocked Gemini test suite verifying initial analysis, zero-redundant LLM calls for identical job descriptions across applications, and retry path recovery.

---

### Stage 5: Background Jobs (Stale Application & Ghosting Detector)
- **What Was Built**:
  - `src/config/staleness.js`: `STALE_THRESHOLD_DAYS = 21` (3 weeks) and hourly background interval constants.
  - `src/services/staleCheckService.js`: `checkForStaleApplications()` updating applications with `status = 'applied'` and `applied_at <= NOW() - 21 days` to `'ghosted'`.
  - `src/jobs/staleCheckJob.js`: Periodic `setInterval` background worker with `startStaleCheckJob()` and `stopStaleCheckJob()`.
  - `src/routes/staleCheck.js`: `POST /applications/stale-check/run` manual override trigger for on-demand demonstration.
  - `tests/staleCheck.test.js`: Verified 25-day old applications flip to ghosted, 5-day old applications remain applied, interview/rejected statuses are preserved, idempotency holds, and manual trigger operates correctly.
- **Issue Encountered & Fix**:
  - *Issue*: In tests, running the test suite multiple times caused `tests/analysis.test.js` to hit a pre-existing cached hash from a previous test run.
  - *Fix*: Made the test job description dynamic using timestamp suffixes (`Senior Backend Engineer (Test Run ${Date.now()})`), guaranteeing clean test isolation on every execution.
  - *Issue*: Background worker startup scan could trigger while the test runner was closing the database pool in `test.after()`.
  - *Fix*: Handled pool teardown error gracefully in the startup catch handler of `staleCheckJob.js`.

---

### Stage 6: PDF Report Generation & Conversion Analytics
- **What Was Built**:
  - `src/services/reportDataService.js`: `buildReportData()` computing response rates, rejection rates, ghosted rates, and breakdowns by resume variant and application channel, with low sample size flags (`total < 3`).
  - `src/services/pdfReportService.js`: `generateReportPDF()` using `pdfkit` to render clean executive PDF reports with styled headers, 4-column summary metric cards, sorted conversion tables, and advisory recommendations.
  - `src/repositories/reportRepository.js`: Persistence layer for `weekly_reports`.
  - `src/routes/reports.js`: `POST /reports/generate`, `GET /reports`, and `GET /reports/:id/download` with file streaming.
  - `tests/report.test.js`: 7 automated tests verifying mathematical calculation accuracy, real PDF file creation on disk, streaming downloads, and cross-user download prevention.

---

### Stage 7: Final Consolidation & Verification
- **Summary**:
  - Executed full automated test suite: 48/48 tests passing across all 6 test files.
  - Created `EVIDENCE.md` documenting verifiable proof for every concept.
  - Synchronized `NOTES.md` and `memory.md`.
  - Generated and validated live demo PDF in `./outputs/demo_weekly_report.pdf`.
