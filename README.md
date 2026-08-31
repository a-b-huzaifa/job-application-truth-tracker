# Job Application Truth Tracker 🎯

> **A personal intelligence tool for tracking job applications, diagnosing rejection/ghosting patterns with Google Gemini, background dormancy auditing, and generating executive conversion reports.**

---

## 1. What the System Does

Job Application Truth Tracker transforms the job search from an unstructured "spray and pray" guessing game into an **empirical, data-driven feedback loop**. 

Instead of maintaining static spreadsheets or relying on opaque applicant tracking systems, Truth Tracker provides:
1. **Resume Variant Management**: Store and evaluate distinct resume versions (e.g. *Full-Stack Generalist*, *DevOps Specialist*, *Distributed Systems*).
2. **AI-Powered Match Fidelity**: Compares your resume directly against job descriptions using Google Gemini 1.5 Flash to compute an objective `0-100%` fit score and identify concrete keyword/experience gaps.
3. **Cryptographic Caching**: Uses SHA-256 digests of job descriptions to avoid redundant LLM invocations and token costs.
4. **Automated Ghosting Audits**: A background worker automatically detects applications sitting in `'applied'` status for more than 21 days with no response, transitioning them to `'ghosted'` to keep funnel metrics truthful.
5. **Executive Weekly PDF Reports**: Generates downloadable PDF summaries with conversion rate rankings by resume variant and platform to show what is actually getting interviews.

---

## 2. System Architecture

```
                          +-------------------------------+
                          |     HTTP Client / cURL / UI   |
                          +-------------------------------+
                                          |
                                          v
+===================================================================================+
|                             EXPRESS APPLICATION LAYER (server/)                   |
|                                                                                   |
|  +-----------------------------------------------------------------------------+  |
|  | Middleware: Auth (Bearer JWT Verification) | Validation (Zod Schema Guard)  |  |
|  +-----------------------------------------------------------------------------+  |
|                                         |                                         |
|  +-----------------------------------------------------------------------------+  |
|  | Routes: /auth | /resumes | /applications | /applications/:id/analyze | ...  |  |
|  +-----------------------------------------------------------------------------+  |
|                                         |                                         |
|  +-----------------------------------------------------------------------------+  |
|  | Services Layer:                                                             |  |
|  |  • analysisService (Gemini LLM Integration + Resilient Retry)               |  |
|  |  • hashService (SHA-256 Normalized Digest Computation)                      |  |
|  |  • staleCheckService (Dormancy Detection & Status Mutations)                |  |
|  |  • reportDataService (Conversion Analytics & Resume Rankings)               |  |
|  |  • pdfReportService (PDFKit Document Compiler)                              |  |
|  +-----------------------------------------------------------------------------+  |
|                     |                                         |                   |
|                     v (External LLM)                          v (Export Storage)  |
|            +-----------------+                       +-----------------------+    |
|            | Google Gemini   |                       | server/outputs/*.pdf  |    |
|            | 1.5 Flash API   |                       +-----------------------+    |
|            +-----------------+                                                    |
|                                         |                                         |
|  +-----------------------------------------------------------------------------+  |
|  | Repositories Layer (Parameter-Bound SQL):                                   |  |
|  |   userRepository | resumeRepository | applicationRepository                |  |
|  |   analysisRepository | reportRepository                                     |  |
|  +-----------------------------------------------------------------------------+  |
+=========================================|=========================================+
                                          |
                                          v
+===================================================================================+
|                              DATA PERSISTENCE LAYER                               |
|                                                                                   |
|            PostgreSQL 15 (Docker Container via node pg.Pool Client)               |
|            Tables: users, resumes, applications, llm_analyses, weekly_reports      |
+=========================================^=========================================+
                                          | (Periodic Scan)
                            +----------------------------------+
                            | Background Worker (Cron)         |
                            |  server/src/jobs/staleCheckJob   |
                            +----------------------------------+
```

---

## 3. Quickstart & Setup

### Prerequisites
- Node.js (v18+ or v20+ recommended, ESM native)
- Docker & Docker Compose (for PostgreSQL 15)

### Step 1: Clone & Install Dependencies
```bash
git clone https://github.com/a-b-huzaifa/job-application-truth-tracker.git
cd job-application-truth-tracker/server
npm install
```

### Step 2: Configure Environment
Copy the `.env.example` file to `.env` inside `server/`:
```bash
cp .env.example .env
```

Generate a secure 256-bit JWT secret:
```bash
node -e "console.log(crypto.randomBytes(32).toString('hex'))"
```
Paste this into `server/.env` as `JWT_SECRET`. Add your Google Gemini API key from [Google AI Studio](https://aistudio.google.com/) as `GEMINI_API_KEY`.

### Step 3: Start Database & Run Migrations
```bash
# Start PostgreSQL in background (inside server/)
docker compose up -d

# Run database schema migrations
node migrate.js

# Seed demo user, resumes, applications, and cached analyses
node seed.js
```

### Step 4: Run Tests & Start Server
```bash
# Execute the full 48-test automated suite (inside server/)
npm test

# Start the Express server (default: port 3000)
npm start
```

---

## 4. Concept to Implementation Mapping

| Graded Concept | Description | Implementation Location |
| :--- | :--- | :--- |
| **1. Cryptographic Caching** | SHA-256 hashing of JDs to eliminate redundant LLM calls | • `server/src/services/hashService.js`<br>• `server/src/repositories/analysisRepository.js`<br>• `server/src/services/analysisService.js`<br>• Index `idx_llm_analyses_jd_hash` |
| **2. Background Jobs / Cron** | Scheduled dormancy scanner identifying ghosted applications (>21 days) | • `server/src/config/staleness.js`<br>• `server/src/services/staleCheckService.js`<br>• `server/src/jobs/staleCheckJob.js`<br>• `server/src/routes/staleCheck.js` |
| **3. Layered 4-Tier Architecture** | Separation of Routes $\to$ Middleware $\to$ Services $\to$ Repositories $\to$ DB | • `server/src/routes/`<br>• `server/src/middleware/`<br>• `server/src/services/`<br>• `server/src/repositories/`<br>• `server/src/db.js` |
| **4. File Generation (PDF)** | Weekly executive truth reports with conversion metrics compiled to disk | • `server/src/services/reportDataService.js`<br>• `server/src/services/pdfReportService.js`<br>• `server/src/repositories/reportRepository.js`<br>• `server/src/routes/reports.js` |
| **5. LLM Structured Output** | Resume-to-Job fit evaluation with Zod schema validation & automatic retry | • `server/src/services/analysisService.js`<br>• `server/src/routes/analyze.js` |
| **6. Authentication & Security** | User registration, bcrypt password hashing, JWT auth, tenant isolation | • `server/src/middleware/auth.js`<br>• `server/src/repositories/userRepository.js`<br>• `server/src/routes/auth.js`<br>• `server/tests/auth.test.js` |

---

## 5. Full Demo Lifecycle Walkthrough (cURL)

Follow these steps on a running server (`npm start`):

### 1. Authenticate (Login)
```bash
curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@truth-tracker.io", "password": "password123"}'
```
*Save the returned `token` to an environment variable:*
```bash
TOKEN="<PASTE_RETURNED_JWT_HERE>"
```

### 2. Create a Resume Variant
```bash
curl -s -X POST http://localhost:3000/resumes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cloud Infrastructure Specialist",
    "content": "Specialized in AWS, Terraform, Docker, Kubernetes, CI/CD pipelines, Prometheus."
  }'
```
*Copy the returned `resume.id` as `RESUME_ID`.*

### 3. Log a New Job Application
```bash
curl -s -X POST http://localhost:3000/applications \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resume_id": "<RESUME_ID>",
    "company_name": "Datadog",
    "role_title": "Site Reliability Engineer",
    "job_description": "We are seeking an SRE with deep Kubernetes, Terraform, and AWS observability experience.",
    "platform": "linkedin",
    "applied_at": "2026-08-15"
  }'
```
*Copy the returned `application.id` as `APP_ID`.*

### 4. Analyze Match Fit (Cache Miss $\to$ Invokes Gemini)
```bash
curl -s -X POST http://localhost:3000/applications/<APP_ID>/analyze \
  -H "Authorization: Bearer $TOKEN"
```
**Response:**
```json
{
  "message": "Analysis generated successfully",
  "application_id": "<APP_ID>",
  "fit_score": 90,
  "mismatch_reasons": [
    "Strong match across AWS, Terraform, and Kubernetes infrastructure."
  ],
  "cached": false
}
```

### 5. Re-Analyze Identical Job Description (Demonstrates Cache Hit)
Create another application at another company with the exact same job description, and analyze it:
```bash
curl -s -X POST http://localhost:3000/applications/<ANOTHER_APP_ID>/analyze \
  -H "Authorization: Bearer $TOKEN"
```
**Response:**
```json
{
  "message": "Analysis retrieved from cache",
  "application_id": "<ANOTHER_APP_ID>",
  "fit_score": 90,
  "mismatch_reasons": [
    "Strong match across AWS, Terraform, and Kubernetes infrastructure."
  ],
  "cached": true
}
```
*(Notice `cached: true` — resolved instantly from Postgres with zero external LLM token usage).*

### 6. Manually Trigger Stale Application Audit
```bash
curl -s -X POST http://localhost:3000/applications/stale-check/run \
  -H "Authorization: Bearer $TOKEN"
```
**Response:**
```json
{
  "message": "Stale application check executed successfully",
  "summary": {
    "checked": 3,
    "flagged_as_ghosted": 2
  }
}
```

### 7. Generate & Download Truth PDF Report
```bash
# Generate the report
curl -s -X POST http://localhost:3000/reports/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"period_start": "2026-07-01", "period_end": "2026-08-30"}'
```
*Use the returned `report.id` to download the PDF binary:*
```bash
curl -s -X GET http://localhost:3000/reports/<REPORT_ID>/download \
  -H "Authorization: Bearer $TOKEN" \
  --output ./weekly_truth_report.pdf
```
*Open `./weekly_truth_report.pdf` to view your compiled conversion metrics and resume rankings.*

---

## 6. Future Ideas (Intentional Non-Goals)

To preserve data integrity, account safety, and focus on genuine insight, the following features were **explicitly excluded** from scope:
- **No Auto-Apply Bots**: Submitting mass automated applications violates platform terms of service and floods hiring pipelines with low-signal spam.
- **No Job Board Web Scraping**: No automated scraping of LinkedIn, Indeed, or Wellfound pages, avoiding brittle HTML dependencies and rate-limit blocks.
- **No Browser Automation**: No Puppeteer/Playwright scripts hijacking candidate login sessions.

*Planned future enhancements:*
- Webhook notifications (Slack/Discord) when an application transitions to ghosted status.
- Integration with local Ollama / Mistral models for offline analysis.
- Advanced keyword extraction visualizing missing ATS hard skills.

---

## 7. Limitations & Design Notes

- **Single-User Focused Design**: While the database schema, JWT auth middleware, and repositories enforce multi-tenant isolation (`WHERE user_id = $1`), the application is optimized as a lightweight, personal tracker.
- **Company Field Modeling**: As documented in `DESIGN.md`, `company_name` is stored as a direct string rather than a relational `companies` table to eliminate unnecessary join complexity and avoid fuzzy deduplication overhead.

---

## 8. Agentic Workflows Hackathon Addendum 🤖

This repository has been upgraded on branch `hackathon-agentic-v2` with an autonomous 4-Stage Multi-Agent Architecture, Human-in-the-Loop Decision Gates, Persistent Evaluative Memory, and an Interactive Brutalist UI.

### Key Hackathon Artifacts & Documentation
- 📄 **[BASELINE.md](hackathon/BASELINE.md)**: Specification and benchmark characterization of the legacy single-prompt Gemini evaluation pipeline (`analyzeApplicationFit` in `server/src/services/analysisService.js`).
- 📊 **[EVALUATION.md](hackathon/EVALUATION.md)**: 18-case empirical benchmark comparison matrix across 4 testing regimes (straightforward matches, deliberate overclaims, sparse JDs, and the hard case).
- 📜 **[CHANGELOG.md](hackathon/CHANGELOG.md)**: Engineering decision log detailing each stage of evolution, evidence cited, and architectural decisions (kept/revised/removed).
- 🛠️ **[REPRODUCE.md](hackathon/REPRODUCE.md)**: Complete reproduction guide with exact commands, environment configurations, and expected runtimes for both backend and frontend.

### Safety & Human-in-the-Loop Guarantees
> **Zero Autonomous Mutation Invariant:** No AI action, resume modification, or strategy decision is **ever** auto-executed without explicit human approval. Proposed resume rewrites and application strategy plans are persisted as advisory records requiring candidate sign-off via the Human Approval Gate (`POST /applications/:id/strategist-actions/:actionId/approve`), guaranteeing that no candidate resume content is ever mutated by automated background workflows.

### v2.0 Latest Additions
- **Provider-Agnostic LLM Layer:** Support for Gemini, OpenAI, and OpenRouter through a dynamic `.env` configuration.
- **Dynamic Resume Tailoring:** Generates DOCX files instantly targeting specific Job Description gaps based on Strategist advice.
- **Historical Memory Insights:** Global dashboard surfacing recurring JATT flags across your past applications.

