# Hackathon Baseline — Current Job Fit Analysis System

This document establishes the official **pre-hackathon baseline** for the Job Application Truth Tracker's analysis system, against which all multi-agent and agentic improvements will be benchmarked.

---

## 1. Overview of Current Baseline Architecture

The current analysis system is a **single-step, single-prompt LLM evaluation pipeline** that compares candidate resume text against a job description.

- **Primary Entrypoint (Route)**: `POST /applications/:id/analyze` located at [`src/routes/analyze.js`](file:///d:/FlyRank%20Internship/FlyRank%20Capstone%2010x%20Scope%20Job%20Application%20Truth%20Tracker/src/routes/analyze.js)
- **Primary Domain Service**: [`src/services/analysisService.js`](file:///d:/FlyRank%20Internship/FlyRank%20Capstone%2010x%20Scope%20Job%20Application%20Truth%20Tracker/src/services/analysisService.js)
- **Exact Primary Function**: `analyzeApplicationFit(resume, jobDescription, applicationId = null)`
- **Internal Invocation Function**: `callGeminiModel(resumeContent, jobDescription, isRetry = false)`
- **Cryptographic Caching Service**: [`src/services/hashService.js`](file:///d:/FlyRank%20Internship/FlyRank%20Capstone%2010x%20Scope%20Job%20Application%20Truth%20Tracker/src/services/hashService.js) (`hashText`)
- **Persistence Repository**: [`src/repositories/analysisRepository.js`](file:///d:/FlyRank%20Internship/FlyRank%20Capstone%2010x%20Scope%20Job%20Application%20Truth%20Tracker/src/repositories/analysisRepository.js)

---

## 2. Baseline Flow & Logic

```
   [POST /applications/:id/analyze]
                 │
                 ▼
   Fetch Application & Linked Resume (Postgres)
                 │
                 ▼
   Compute SHA-256 Hash of JD (hashText in src/services/hashService.js)
                 │
                 ├─── Cache Hit (llm_analyses table) ───► Return Cached Result { cached: true, fit_score, mismatch_reasons }
                 │
                 ▼ (Cache Miss)
   callGeminiModel() in src/services/analysisService.js (Single Gemini 1.5 Flash Call)
                 │
                 ▼
   Zod Schema Validation (analysisSchema: fit_score [0-100], mismatch_reasons [string[]])
                 │
                 ├─── If JSON parsing fails ───► 1 Retry with Stricter System Prompt
                 │
                 ▼
   Persist to llm_analyses table
                 │
                 ▼
   Return Response { cached: false, fit_score, mismatch_reasons }
```

### Exact Code References

#### 1. Primary Function Signature ([`src/services/analysisService.js`](file:///d:/FlyRank%20Internship/FlyRank%20Capstone%2010x%20Scope%20Job%20Application%20Truth%20Tracker/src/services/analysisService.js#L93-L156)):
```javascript
export async function analyzeApplicationFit(resume, jobDescription, applicationId = null)
```

#### 2. LLM Invocation Logic ([`src/services/analysisService.js`](file:///d:/FlyRank%20Internship/FlyRank%20Capstone%2010x%20Scope%20Job%20Application%20Truth%20Tracker/src/services/analysisService.js#L38-L83)):
```javascript
async function callGeminiModel(resumeContent, jobDescription, isRetry = false)
```
- **Model**: `gemini-1.5-flash` via `@google/generative-ai` SDK
- **Prompt Structure**: Direct single-turn comparison asking for JSON schema:
  ```json
  {
    "fit_score": <integer between 0 and 100>,
    "mismatch_reasons": ["gap 1", "gap 2"]
  }
  ```

#### 3. Route Handler ([`src/routes/analyze.js`](file:///d:/FlyRank%20Internship/FlyRank%20Capstone%2010x%20Scope%20Job%20Application%20Truth%20Tracker/src/routes/analyze.js#L13-L59)):
```javascript
router.post('/:id/analyze', async (req, res) => { ... })
```

---

## 3. Baseline Characteristics & Metrics

| Dimension | Baseline State |
| :--- | :--- |
| **Agent Paradigm** | Single-turn, direct prompt-response (Zero autonomous tooling/subagents) |
| **Number of LLM Invocations** | 1 call (or 2 if the first output fails JSON validation) |
| **Model** | Google Gemini 1.5 Flash (`gemini-1.5-flash`) |
| **Output Schema** | Simple `{ fit_score: number, mismatch_reasons: string[] }` |
| **Context Extraction** | Monolithic text concatenation of resume + job description |
| **Critique / Verification** | None (no multi-agent debate, no factual grounding check, no iterative resume refinement) |
| **Execution Latency** | ~800ms - 1500ms on cache miss, <5ms on SHA-256 cache hit |

---

## 4. Hackathon Comparison Criteria

Multi-agent v2 enhancements in this hackathon branch will be evaluated against this baseline on:
1. **Depth of Analysis**: Granular breakdown (technical skill gap vs. domain experience vs. seniority mismatch) vs. single monolithic fit score.
2. **Actionable Suggestions**: Concrete resume bullet point rewrite suggestions and keyword optimizations vs. high-level bullet points.
3. **Agentic Architecture**: Multi-agent workflow (e.g. Extraction Agent $\to$ Gap Diagnosis Agent $\to$ ATS Optimization Agent $\to$ Truth Auditor) vs. single `callGeminiModel` step.
4. **Accuracy & Hallucination Resistance**: Multi-perspective evaluation with reflection / self-critique.
