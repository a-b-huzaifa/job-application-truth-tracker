# Job Application Truth Tracker — System Design Document (DESIGN.md)

## 1. Problem Statement & Executive Summary

### The Problem
Job seekers in the modern tech market suffer from asymmetric feedback. Candidates often submit dozens or hundreds of job applications across disparate platforms (LinkedIn, Wellfound, Micro1, direct company portals) with zero empirical insight into:
1. **Fit Fidelity**: Why specific resumes fail or succeed against given job descriptions.
2. **Ghosting & Stagnation**: Which applications have stalled without candidate follow-up.
3. **Funnel Truth**: What platforms and resume variants yield genuine interviews vs. silent rejections.

Job seekers are left with manual spreadsheets or bloated applicant management tools that do not provide automated analytical feedback.

### Who Has It
Software engineers, DevOps practitioners, engineering managers, and technical candidates actively navigating multi-channel hiring pipelines who require objective, data-backed oversight of their job search campaign.

### The 10x Claim
**Job Application Truth Tracker transforms job searching from an emotional "spray and pray" guessing game into an empirical, data-driven optimization loop.** By combining automated LLM-powered resume-to-job fit scoring, cryptographic caching, proactive background ghosting detection, and weekly executive PDF audits, candidates 10x their awareness of application health and pinpoint mismatch causes instantly.

### The 6 Core Concepts Implemented
1. **Cryptographic Caching**: SHA-256 hashing of job descriptions stored in `llm_analyses(job_description_hash)` to avoid redundant, costly Gemini LLM evaluations across identical roles.
2. **Background Jobs & Scheduling**: Automated cron-based background jobs evaluating application dormancy (`status` + `last_status_check` / `applied_at`) to flag ghosted applications, paired with a manual trigger endpoint for administrative audit runs.
3. **Layered 4-Tier Architecture**: Strict separation of concerns (`routes` $\to$ `middleware` $\to$ `services` $\to$ `repositories` $\to$ `database`) isolating domain logic from transport protocols and storage.
4. **File Generation & Export**: Weekly executive report generator creating structured PDF summaries (`outputs/`) using PDFKit, detailing funnel conversion rates and top mismatch trends.
5. **LLM Integration with Strict Structured Outputs**: Gemini API client configured with Zod schema validation ensuring consistent JSON output (`fit_score` integer 0-100, `mismatch_reasons` string array).
6. **Authentication, Multi-Tenancy & Security**: JWT-based session tokens with bcrypt-hashed credentials and user-scoped relational constraints across all queries.

### Explicit Non-Goals
- **NO Automated Application Submission**: The system does not auto-apply or submit forms to employer career pages.
- **NO Job Board Scraping**: No web scrapers or unauthorized crawling of LinkedIn, Indeed, or Wellfound.
- **NO Browser Automation**: No Puppeteer / Playwright bots simulating user logins on job platforms.
- *Focus*: 100% focused on structured candidate data entry, automated intelligence, feedback loops, and truth tracking.

---

## 2. Data Model Sketch & Schema Design

```
 +----------------------------------------------------------------------------+
 |                                  USERS                                     |
 |----------------------------------------------------------------------------|
 | PK  id             UUID (DEFAULT gen_random_uuid())                        |
 |     email          VARCHAR(255) UNIQUE NOT NULL                            |
 |     password_hash  TEXT NOT NULL                                           |
 |     created_at     TIMESTAMPTZ DEFAULT NOW()                               |
 +----------------------------------------------------------------------------+
       | 1
       |
       +-------------------------+-------------------------+
       | 1:N                     | 1:N                     | 1:N
       v                         v                         v
 +-------------------+     +-----------------------+     +--------------------+
 |      RESUMES      |     |     APPLICATIONS      |     |   WEEKLY_REPORTS   |
 |-------------------|     |-----------------------|     |--------------------|
 | PK  id            |     | PK  id                |     | PK  id             |
 | FK  user_id       |     | FK  user_id           |     | FK  user_id        |
 |     name          |<-+  | FK  resume_id (NULL)  |     |     period_start   |
 |     content       |  |  |     company_name      |     |     period_end     |
 |     created_at    |  |  |     role_title        |     |     file_path      |
 +-------------------+  |  |     job_description   |     |     generated_at   |
                        |  |     platform          |     +--------------------+
                        |  |     applied_at        |
                        |  |     status            |
                        |  |     last_status_check |
                        |  |     created_at        |
                        |  +-----------------------+
                        |            | 1
                        +-(FK 0..1)--+
                                     | 1:N
                                     v
                           +------------------------+
                           |      LLM_ANALYSES      |
                           |------------------------|
                           | PK  id                 |
                           | FK  application_id     |
                           |     fit_score (0-100)  |
                           |     mismatch_reasons   |
                           |     job_description_   |
                           |       hash (UNIQUE)    |
                           |     created_at         |
                           +------------------------+
```

### Architectural Decision: Modeling Company Names
**Decision**: `company_name` is stored directly as a text field on `applications` instead of a separate `companies` table.
**Rationale**:
- Eliminates unnecessary relational joins and foreign key lookups for a personal tracking tool.
- Prevents company deduplication/aliasing complexity (e.g., "Google LLC" vs. "Google" vs. "Google Inc.").
- Applications remain self-contained, lightweight, and easily exportable.

### Entity Definitions & Constraints

#### 1. `users`
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `email`: `VARCHAR(255) UNIQUE NOT NULL`
- `password_hash`: `TEXT NOT NULL`
- `created_at`: `TIMESTAMPTZ DEFAULT NOW()`

#### 2. `resumes`
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id`: `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
- `name`: `VARCHAR(255) NOT NULL` (e.g., "Full-Stack Generalist v1", "DevOps Cloud Specialist")
- `content`: `TEXT NOT NULL` (Markdown or plain text representation of skills & history)
- `created_at`: `TIMESTAMPTZ DEFAULT NOW()`
- *Index*: `idx_resumes_user_id` on `(user_id)`

#### 3. `applications`
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id`: `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
- `resume_id`: `UUID REFERENCES resumes(id) ON DELETE SET NULL`
- `company_name`: `VARCHAR(255) NOT NULL`
- `role_title`: `VARCHAR(255) NOT NULL`
- `job_description`: `TEXT NOT NULL`
- `platform`: `VARCHAR(64) NOT NULL` (e.g., `'linkedin'`, `'wellfound'`, `'micro1'`, `'direct'`)
- `applied_at`: `DATE NOT NULL`
- `status`: `VARCHAR(32) NOT NULL CHECK (status IN ('applied', 'response_received', 'rejected', 'ghosted', 'interview'))`
- `last_status_check`: `TIMESTAMPTZ DEFAULT NOW()`
- `created_at`: `TIMESTAMPTZ DEFAULT NOW()`
- *Indexes*:
  - `idx_applications_user_id` on `(user_id)`
  - `idx_applications_status_check` on `(status, last_status_check)` (optimized for background stale check queries)

#### 4. `llm_analyses`
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `application_id`: `UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE`
- `fit_score`: `INTEGER NOT NULL CHECK (fit_score >= 0 AND fit_score <= 100)`
- `mismatch_reasons`: `JSONB NOT NULL DEFAULT '[]'::jsonb`
- `job_description_hash`: `VARCHAR(64) NOT NULL UNIQUE` (SHA-256 hex digest)
- `created_at`: `TIMESTAMPTZ DEFAULT NOW()`
- *Indexes*:
  - `idx_llm_analyses_application_id` on `(application_id)`
  - `idx_llm_analyses_jd_hash` UNIQUE on `(job_description_hash)`

#### 5. `weekly_reports`
- `id`: `UUID PRIMARY KEY DEFAULT gen_random_uuid()`
- `user_id`: `UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
- `period_start`: `DATE NOT NULL`
- `period_end`: `DATE NOT NULL`
- `file_path`: `TEXT NOT NULL`
- `generated_at`: `TIMESTAMPTZ DEFAULT NOW()`
- *Index*: `idx_weekly_reports_user_id` on `(user_id)`

---

## 3. API Surface (Route List Specification)

| Method | Endpoint | Description | Auth Required |
| :--- | :--- | :--- | :---: |
| **POST** | `/api/auth/register` | Register new user account with email & password | No |
| **POST** | `/api/auth/login` | Authenticate user and issue JWT token | No |
| **GET** | `/api/auth/me` | Fetch authenticated user profile | Yes |
| **GET** | `/api/resumes` | List all resumes for the user | Yes |
| **POST** | `/api/resumes` | Create a new resume variant | Yes |
| **GET** | `/api/resumes/:id` | Get resume details by ID | Yes |
| **PUT** | `/api/resumes/:id` | Update resume title/content | Yes |
| **DELETE** | `/api/resumes/:id` | Delete resume | Yes |
| **GET** | `/api/applications` | List applications with filters (status, platform) | Yes |
| **POST** | `/api/applications` | Log a new job application | Yes |
| **GET** | `/api/applications/:id` | Get application details & analysis | Yes |
| **PUT** | `/api/applications/:id` | Update application status / details | Yes |
| **DELETE** | `/api/applications/:id` | Remove application record | Yes |
| **POST** | `/api/applications/:id/analyze` | Trigger LLM fit analysis (uses cache if hash matches) | Yes |
| **GET** | `/api/reports` | List generated weekly reports | Yes |
| **POST** | `/api/reports/generate` | Generate new weekly truth report PDF | Yes |
| **GET** | `/api/reports/:id/download` | Download generated PDF report file | Yes |
| **POST** | `/api/jobs/stale-check` | Manual override trigger for stale/ghosting audit | Yes |

---

## 4. Layered Architecture & ASCII System Sketch

```
                     +-----------------------------------+
                     |           Client / HTTP           |
                     +-----------------------------------+
                                       |
                                       v
                     +-----------------------------------+
                     |           Express App             |
                     +-----------------------------------+
                                       |
                   +-------------------+-------------------+
                   |                                       |
                   v                                       v
         +-------------------+                   +-------------------+
         |  Auth Middleware  |                   | Validation (Zod)  |
         +-------------------+                   +-------------------+
                   |                                       |
                   +-------------------+-------------------+
                                       |
                                       v
  +=========================================================================+
  |                             ROUTES LAYER                                |
  |   auth.routes.js | resume.routes.js | app.routes.js | report.routes.js  |
  +=========================================================================+
                                       |
                                       v
  +=========================================================================+
  |                            SERVICES LAYER                               |
  |  - AuthService         - ApplicationService     - StaleCheckerService   |
  |  - ResumeService      - ReportService          - LLMService (Gemini)   |
  +=========================================================================+
            |                          |                          |
            | (External Integration)   | (External Integration)   |
            v                          v                          |
   +-----------------+        +-----------------+                 |
   |   Gemini SDK    |        |   PDFKit Engine |                 |
   |  (Structured    |        |  (Weekly Report |                 |
   |   JSON Output)  |        |   PDF Writer)   |                 |
   +-----------------+        +-----------------+                 |
                                                                  |
                                       +--------------------------+
                                       |
                                       v
  +=========================================================================+
  |                          REPOSITORIES LAYER                             |
  |  - UserRepository      - ApplicationRepository  - AnalysisRepository    |
  |  - ResumeRepository    - ReportRepository                               |
  +=========================================================================+
                                       |
                                       v
  +=========================================================================+
  |                           DATABASE LAYER                                |
  |               PostgreSQL 15 (Docker / pg Pool Client)                   |
  +=========================================================================+
                                       ^
                                       | (Cron Invocation)
                         +---------------------------+
                         |    Background Jobs /      |
                         |      Cron Scheduler       |
                         |  (Stale Application Audit)|
                         +---------------------------+
```

---

## 5. Security, Caching & Operational Lifecycle

1. **Password Hashing**: Stored via `bcrypt` with salt rounds = 10.
2. **Session Isolation**: All repositories enforce `WHERE user_id = $1` on queries.
3. **LLM Cache Flow**:
   - Calculate `sha256(job_description.trim())`.
   - Query `llm_analyses` by `job_description_hash`.
   - If found: Return cached `fit_score` and `mismatch_reasons` immediately without API call.
   - If miss: Call Gemini API, validate response against Zod schema, persist with hash, and return.
4. **Stale Check Flow**:
   - Query all applications where `status = 'applied'` AND `applied_at < NOW() - INTERVAL '14 days'`.
   - Automatically mark status as `'ghosted'` or notify user for review; update `last_status_check = NOW()`.
