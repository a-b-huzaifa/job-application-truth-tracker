# Hackathon Engineering Changelog & Decision Records

This document tracks the iterative evolution of the **Truth Tracker** multi-agent architecture across each developmental stage. Every entry records the experimental hypothesis, empirical evidence cited from [`hackathon/EVALUATION.md`](file:///d:/FlyRank%20Internship/FlyRank%20Capstone%2010x%20Scope%20Job%20Application%20Truth%20Tracker/hackathon/EVALUATION.md), and architectural decisions (Kept / Revised / Removed).

---

## Stage 1: Official Baseline Benchmarking
- **What Was Tried:** Documented the legacy single-prompt LLM evaluation pipeline (`analyzeApplicationFit` in `server/src/services/analysisService.js`) as the frozen benchmark baseline.
- **Evidence Cited from EVALUATION.md:**
  - In overclaiming test cases (Cases 11–14), the baseline assigned artificially high fit scores (**78%–85%**) due to superficial keyword and title matching.
  - In sparse/vague job descriptions (Cases 15–17), the baseline suffered from hallucinated requirement gaps, dropping fit scores down to **58%–65%**.
  - In the complex High-Velocity Systems Engineer test (Case 18), the single-prompt baseline misidentified dense production metrics (1.2M rps, 4ms p99) as unrealistic exaggeration, penalizing the candidate with a **68%** score.
- **Decision:** **KEPT** as the reference baseline; left unmodified to serve as an objective comparator for `POST /applications/:id/analyze-v2`.

---

## Stage 2: Client/Server Layout Restructuring
- **What Was Tried:** Migrated the monolithic repository into a modular `client/` and `server/` layout. Moved all backend services, tests, database migrations, and seed scripts into `server/` without altering core business logic.
- **Evidence Cited from EVALUATION.md:** Backend test suite maintained 100% pass rate (48/48 unit/integration tests passing) across PostgreSQL 15, confirming zero regressions.
- **Decision:** **KEPT**. Clean boundary separation between Node.js API services and the upcoming React frontend.

---

## Stage 3: Specialized Agentic Microservices (Extractor, Matcher, Verifier)
- **What Was Tried:** Decomposed the monolithic evaluation prompt into specialized micro-agents:
  1. `extractorService.js`: Parses raw unstructured resume text into validated Zod JSON (`skills[]`, `years_experience`, `tools[]`).
  2. `matcherService.js`: Scores structured competencies against JD requirements.
  3. `verifierService.js`: Re-checks claimed mismatches against raw source text, emitting typed flags:
     - `'unsupported'`: Factually false claims (e.g. ATS screener hallucinations).
     - `'phrasing_risk'`: Substantively true claims phrased with overclaiming risk.
- **Evidence Cited from EVALUATION.md:**
  - Debunked fabricated credentials across Cases 11–14, adjusting scores from **81.3% baseline avg** down to **13.8% verified avg** (-67.5% correction).
  - Clean distinction between genuine skill gaps vs. aggressive wording.
- **Decision:** **KEPT**. Fixed single-prompt prompt-injection vulnerability and hallucination leakage.

---

## Stage 4: Candidate Strategist & 4-Stage Orchestrator Pipeline
- **What Was Tried:**
  - Built `strategistService.js` to recommend tactical actions (`REWRITE_SUGGESTED`, `APPLY_WITH_CAVEAT`, `SKIP_ROLE_RECOMMENDED`) based on Verifier findings.
  - Built `orchestratorService.js` to execute `Extractor -> Matcher -> Verifier -> Strategist` in sequence, logging execution metadata (`{ step, input, output, duration_ms }`) to a `trajectory` array.
  - Exposed `POST /applications/:id/analyze-v2` in `server/src/routes/analyzeV2.js` returning side-by-side baseline and agentic results.
- **Evidence Cited from EVALUATION.md:**
  - Transparent execution tracing: Average agentic evaluation completed across 4 distinct steps with sub-millisecond logging fidelity.
  - Side-by-side contract enabled immediate verification of score deltas.
- **Decision:** **KEPT**. Provides explainable AI reasoning with full audit trail.

---

## Stage 5: Human-in-the-Loop Approval Gate (Safety Architecture)
- **What Was Tried:**
  - Added `strategist_actions` table migration storing action type, payload, status (`pending|approved|rejected`), `applied: boolean`, and timestamps.
  - Built `POST /applications/:id/strategist-actions/:actionId/approve` and `/reject` in `server/src/routes/strategistApproval.js`.
  - Approving sets `status = 'approved'` and `applied = true` strictly on the decision record.
  - Enforced strict invariant: **NO resume record is ever modified or patched by this feature.**
- **Evidence Cited from EVALUATION.md & Test Suite:**
  - Dedicated safety tests confirmed that pending actions cannot be applied under any code path, and no `resumes` table row is ever mutated.
  - Eliminates autonomous AI hallucinations from corrupting candidate source documents.
- **Decision:** **KEPT**. Critical safety guarantee: **Never auto-execute changes without explicit human approval.**

---

## Stage 6: Persistent Resume Memory & Pattern Warnings
- **What Was Tried:**
  - Added `verifier_flags` table migration (`resume_id`, `claim_text`, `flag_type`, `created_at`).
  - Automatically persisted all flagged claims during verifier audits.
  - Built `memoryService.js` with `getResumePatternWarnings(resumeId)` grouping repeated flags by `flag_type` and frequency.
  - Exposed `GET /resumes/:id/insights` and surfaced `pattern_warnings` in the `analyze-v2` payload.
- **Evidence Cited from EVALUATION.md:**
  - Memory service proactively flags repeated screener hallucinations (e.g. Docker missing across 3 separate evaluations) so candidates can optimize their resumes.
- **Decision:** **KEPT**. Transforms isolated evaluations into cumulative cross-application intelligence.

---

## Stage 7: Expanded Benchmark Evaluation Suite (18 Cases)
- **What Was Tried:**
  - Extended `server/seed.js` additively with 18 comprehensive evaluation cases across 4 testing regimes:
    - 10 Straightforward Matches & Mismatches
    - 4 Deliberate Overclaiming Cases
    - 3 Sparse & Vague Job Descriptions
    - 1 Explicitly Hard Case (Factually dense impact metrics resembling overclaiming)
  - Created `server/scripts/evaluate.js` producing `hackathon/EVALUATION.md`.
- **Evidence Cited from EVALUATION.md:**
  - **Overclaiming Detection:** Score dropped from **81.3%** down to **13.8%** (-67.5% correction).
  - **Sparse JDs:** Resilient structured extraction recovered score from **61.0%** to **80.0%**.
  - **The Hard Case (Case 18):** Score recovered from **68%** up to **96%** (**False Positive Avoided: YES**), proving the verifier substantiates real performance metrics.
- **Decision:** **KEPT**. Definitive empirical benchmark proving multi-agent superiority over single-shot baselines.

---

## Stage 8: Brutalist Frontend Client
- **What Was Tried:**
  - Created `client/` using React with a brutalist design system (bold black borders 3-4px solid, hard drop shadows, monospace typography, `#ff3b1f` red accent).
  - Implemented `client/src/api/client.js` with in-memory Bearer token management (no `localStorage`).
  - Created `Dashboard.jsx` (listing tracked applications as brutalist cards), `Login.jsx`, `ApplicationDetail.jsx` (side-by-side baseline vs. agentic pipeline comparison with trajectory and approval badges), and `ResumeInsights.jsx` (ranked memory pattern warnings).
- **Evidence Cited from EVALUATION.md & Client Verification:**
  - Production build compiled cleanly (0 warnings, 0 errors).
  - User is empowered with visual side-by-side inspection and manual approval triggers.
- **Decision:** **KEPT**. Complete end-to-end full-stack agentic application.
