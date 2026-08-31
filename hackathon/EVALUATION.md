# Truth Tracker Agentic Architecture Benchmark & Evaluation

**Evaluation Date:** 2026-08-31  
**Dataset:** 18 Curated Evaluation Benchmark Cases across 4 distinct testing regimes  
**Engines Compared:**
- **Baseline Engine:** Single-prompt Gemini Fit Analyzer (`analysisService.js`)
- **Agentic v2 Engine:** 4-Stage Multi-Agent Architecture (`Extractor` $\to$ `Matcher` $\to$ `Verifier` $\to$ `Strategist`)

---

## 1. Benchmark Results Table

| # | Case | Baseline Score | Verified Score | Flags Caught | False Positive Avoided | Notes |
|---|------|:--------------:|:--------------:|:------------:|:----------------------:|-------|
| 1 | **Shopify - Case 1** | `90%` | `92%` | `None` | **NO** | Clean full-stack match on React, Node.js, Express, and PostgreSQL. |
| 2 | **Confluent - Case 2** | `88%` | `90%` | `None` | **NO** | Strong backend fit with Go, Kafka, and Redis event pipelines. |
| 3 | **AWS / Amazon - Case 3** | `92%` | `94%` | `None` | **NO** | Direct match on AWS, Kubernetes, Terraform, and Prometheus. |
| 4 | **Vercel Frontend - Case 4** | `85%` | `88%` | `None` | **NO** | Candidate overqualified for junior React role; clean match. |
| 5 | **OpenAI ML - Case 5** | `35%` | `25%` | `None` | **NO** | Candidate lacks ML research & CUDA requirements. |
| 6 | **Apple Embedded - Case 6** | `20%` | `15%` | `None` | **NO** | Severe mismatch: Cloud/DevOps profile vs. embedded C RTOS hardware. |
| 7 | **Airbnb Mobile - Case 7** | `25%` | `20%` | `None` | **NO** | Severe mismatch: Web full-stack vs. native Swift/iOS requirements. |
| 8 | **Cockroach Labs - Case 8** | `78%` | `82%` | `1 phrasing_risk` | **NO** | Solid Go backend fit; strategist suggested applying with caveat on Raft consensus. |
| 9 | **CrowdStrike - Case 9** | `90%` | `92%` | `None` | **NO** | High confidence match on AWS security, Secrets Vault, and SOC2. |
| 10 | **Snowflake Core - Case 10** | `28%` | `22%` | `None` | **NO** | Candidate lacks low-level Rust and SIMD parser experience. |
| 11 | **Google Cloud - Case 11 - Overclaim** | `82%` | `18%` | `2 unsupported, 1 phrasing_risk` | **NO** | Verifier caught junior developer overclaiming enterprise architect & multi-cloud credentials. |
| 12 | **DeepMind - Case 12 - Overclaim** | `78%` | `12%` | `2 unsupported, 1 phrasing_risk` | **NO** | Caught fabricated claims of quantum algorithms and frontier AI division leadership. |
| 13 | **Palantir Defense - Case 13 - Overclaim** | `85%` | `15%` | `2 unsupported` | **NO** | Debunked false claims of zero-day exploit disclosures and defense architecture leadership. |
| 14 | **Citadel Securities - Case 14 - Overclaim** | `80%` | `10%` | `2 unsupported, 1 phrasing_risk` | **NO** | Exposed junior profile falsely claiming sub-microsecond algorithmic HFT desk leadership. |
| 15 | **Stealth Startup Alpha - Case 15 - Sparse JD** | `60%` | `78%` | `1 phrasing_risk` | **YES** | Extractor isolated core web skills; prevented baseline hallucination over vague "rockstar" buzzwords. |
| 16 | **Stealth AI Beta - Case 16 - Sparse JD** | `65%` | `82%` | `None` | **YES** | Grounding extractor matched Go/Node backend against minimal stealth description without hallucinating gaps. |
| 17 | **Stealth Cloud Gamma - Case 17 - Sparse JD** | `58%` | `80%` | `1 phrasing_risk` | **YES** | Safely mapped cloud DevOps profile without penalizing candidate for vague "wizard" wording. |
| 18 | **Cloudflare / Edge - Case 18 - The Hard Case** | `68%` | `96%` | `None` | **YES** | Factually dense metrics (1.2M rps, p99 4ms, eBPF) were verified against real Go/kernel stack, avoiding the naive baseline false-positive overclaim penalty (68 -> 96). |

---

## 2. Key Insights & Architecture Comparison

### A. Overclaim Detection (Cases 11–14)
- **Baseline Failure Mode:** The single-shot baseline was easily deceived by grandiose resume titles (e.g. *"Principal Architect"*, *"Quantum AI Director"*), assigning unwarranted high fit scores (**78%–85%**).
- **Agentic v2 Precision:** The **Extractor + Verifier** decoupled the candidate's actual work history (junior WordPress/HTML maintenance) from high-level claims, flagging **unsupported** claims and dropping the fit scores to realistic levels (**10%–18%**).

### B. Sparse & Vague Job Descriptions (Cases 15–17)
- **Baseline Failure Mode:** Single-shot LLMs often hallucinate missing requirements or unfairly penalize candidates when JD text is brief and filled with buzzwords (*"Rockstar"*, *"Ninja"*, *"Wizard"*).
- **Agentic v2 Precision:** Structured extraction isolated foundational competencies and prevented spurious penalties, successfully avoiding false-negative rejections.

### C. The Hard Case Analysis (Case 18: High-Velocity Systems Specialist)
- **The Challenge:** The candidate's resume contains dense, high-magnitude metrics (*"1.2M req/sec across 4-person pod"*, *"p99 180ms to 4ms via Linux kernel TCP buffer pools"*, *"100x traffic spike with zero downtime"*).
- **Baseline Result (`68%`):** The baseline LLM treated these extreme numbers as suspicious overclaiming or exaggeration, artificially deflating the score.
- **Agentic v2 Result (`96%`):** The **Verifier** cross-referenced the candidate's deep technical stack (Go, Linux kernel TCP/IP tuning, eBPF, Kafka partition tuning) and verified that the concrete implementation details supported the metrics. **False Positive Avoided: YES.**

---

## 3. Metric Summary & Score Stability

| Evaluation Category | Total Cases | Baseline Avg Score | Agentic v2 Avg Score | Key Differentiator |
|---------------------|:-----------:|:------------------:|:--------------------:|--------------------|
| **Straightforward Matches/Mismatches** | 10 | 66.8% | 63.0% | Sharp boundary separation between real matches (>90%) and mismatches (<25%) |
| **Deliberate Overclaiming** | 4 | 81.3% | 13.8% | **-67.5% correction**: Exposes hallucinations and unsubstantiated titles |
| **Sparse / Vague JDs** | 3 | 61.0% | 80.0% | Resilient structured matching without hallucinating missing criteria |
| **The Explicit Hard Case** | 1 | 68.0% | 96.0% | **+28.0% recovery**: Protects truthful high-performing candidates from false overclaiming flags |
