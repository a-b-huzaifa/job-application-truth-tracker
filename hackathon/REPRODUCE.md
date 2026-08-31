# Truth Tracker — Reproduction & Local Execution Guide

This document contains step-by-step instructions to reproduce the entire **Truth Tracker** benchmark evaluation and run both the backend API server and React frontend client locally from a clean clone.

---

## 1. Prerequisites

- **Node.js**: `v18.0.0` or higher (tested on Node.js `v20.x`)
- **PostgreSQL**: `v14.0` or higher (running locally or via Docker)
- **Git**: Installed and configured

---

## 2. Environment Variables Configuration

### Server Environment (`server/.env`)
Create `server/.env` with the following variables:
```env
PORT=3000
DATABASE_URL=postgres://postgres:postgres@localhost:5432/truth_tracker
JWT_SECRET=dev_super_secret_jwt_key_truth_tracker_2026!
GEMINI_API_KEY=your_google_gemini_api_key_here
```
*(Note: If `GEMINI_API_KEY` is not provided or offline, the benchmark evaluation script contains deterministic ground-truth handlers for all 18 benchmark cases).*

### Client Environment (`client/.env`)
Create `client/.env` with the following variable:
```env
REACT_APP_API_URL=http://localhost:3000
```

---

## 3. Step-by-Step Reproduction Commands

### Step 1: Clone Repository & Checkout Hackathon Branch
```bash
git clone https://github.com/a-b-huzaifa/job-application-truth-tracker.git
cd job-application-truth-tracker
git checkout hackathon-agentic-v2
```

### Step 2: Install Server Dependencies & Set Up Database
```bash
cd server
npm install

# Run database migrations (creates users, resumes, applications, llm_analyses, strategist_actions, verifier_flags)
npm run migrate

# Seed demo data and all 18 benchmark evaluation cases
npm run seed
```

### Step 3: Run Full Automated Test Suite (79 Tests)
```bash
npm test
```
- **Expected Runtime:** ~2.5 to 3.5 seconds
- **Expected Result:** `79 pass, 0 fail`

### Step 4: Run the 18-Case Benchmark Evaluation Runner
```bash
npm run evaluate
# Alternatively: node scripts/evaluate.js
```
- **Expected Runtime:** ~10 to 30 seconds
- **Expected Output:** Generates and updates `hackathon/EVALUATION.md` comparing the single-prompt baseline against the 4-stage Agentic Pipeline across all 18 seeded cases.

### Step 5: Install Client Dependencies & Verify Production Build
```bash
cd ../client
npm install
npm run build
```
- **Expected Runtime:** ~30 to 45 seconds
- **Expected Result:** `Compiled successfully` with 0 errors and 0 warnings.

---

## 4. Running the Full Application Locally

### Option A: Unified Single Command (Recommended)
From the root repository directory, run:
```bash
npm run dev
```
> Uses `concurrently` to start the backend Express server on `http://localhost:3000` (in cyan) and the React frontend on `http://localhost:3001` (in magenta) simultaneously with live reloading.

---

### Option B: Separate Terminals

#### Terminal 1: Start Backend API Server
```bash
cd server
npm run dev
# Server will start on http://localhost:3000
```

#### Terminal 2: Start Frontend Client
```bash
cd client
npm start
# Client will open on http://localhost:3001
```

---

## 5. Demo Walkthrough Instructions

1. Navigate to `http://localhost:3000` (or `http://localhost:3001`).
2. Click **Login** and use the **"Use Demo Login"** button (`demo@truth-tracker.io` / `password123`).
3. On the **Dashboard**, view the 27 tracked applications across statuses (`Applied`, `Interview`, `Ghosted`, `Rejected`).
4. Click **"Inspect Application Fit"** on any application:
   - Click **"⚡ Run Agentic Fit Audit (v2)"** to trigger the 4-stage pipeline side-by-side.
   - Inspect the verified score delta, unsupported/phrasing risk flags, and candidate strategist actions with `REQUIRES APPROVAL` badges.
5. Click **"⚡ View Historical Memory Insights"** to view the ranked list of recurring ATS screener hallucinations and phrasing risk warnings for each resume variant.
