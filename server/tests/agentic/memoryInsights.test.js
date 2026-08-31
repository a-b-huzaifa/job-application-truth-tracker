import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../../src/index.js';
import { pool } from '../../src/db.js';
import verifierFlagRepository from '../../src/repositories/verifierFlagRepository.js';
import { getResumePatternWarnings } from '../../src/services/agentic/memoryService.js';
import {
  setCustomAiClient as setExtractorMock,
  resetCustomAiClient as resetExtractorMock,
} from '../../src/services/agentic/extractorService.js';
import {
  setCustomAiClient as setMatcherMock,
  resetCustomAiClient as resetMatcherMock,
} from '../../src/services/agentic/matcherService.js';
import {
  setCustomAiClient as setVerifierMock,
  resetCustomAiClient as resetVerifierMock,
} from '../../src/services/agentic/verifierService.js';
import {
  setCustomAiClient as setStrategistMock,
  resetCustomAiClient as resetStrategistMock,
} from '../../src/services/agentic/strategistService.js';
import {
  setCustomAiClient as setBaselineMock,
  resetCustomAiClient as resetBaselineMock,
} from '../../src/services/analysisService.js';

let server;
let baseUrl;

let user1Token = '';
let user1Id = '';
let user2Token = '';
let user2Id = '';
let resumeId = '';
let appId = '';

test.before(async () => {
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  // Create User 1
  const u1Res = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `memory_user1_${Date.now()}@example.com`, password: 'password123!' }),
  });
  const u1Data = await u1Res.json();
  user1Token = u1Data.token;
  user1Id = u1Data.user.id;

  // Create User 2
  const u2Res = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `memory_user2_${Date.now()}@example.com`, password: 'password123!' }),
  });
  const u2Data = await u2Res.json();
  user2Token = u2Data.token;
  user2Id = u2Data.user.id;

  // Create Resume for User 1
  const rRes = await fetch(`${baseUrl}/resumes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user1Token}`,
    },
    body: JSON.stringify({
      name: 'Full Stack Engineer v2',
      content: 'Experienced in Node.js, Express, React, PostgreSQL, Docker with 4 years background.',
    }),
  });
  const rData = await rRes.json();
  resumeId = rData.resume.id;

  // Create Application for User 1
  const appRes = await fetch(`${baseUrl}/applications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user1Token}`,
    },
    body: JSON.stringify({
      resume_id: resumeId,
      company_name: 'Figma',
      role_title: 'Product Infrastructure Engineer',
      job_description: 'Looking for a Senior Backend engineer with 5+ years and Docker.',
      platform: 'wellfound',
      applied_at: '2026-08-15',
    }),
  });
  const appData = await appRes.json();
  appId = appData.application.id;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await pool.end();
});

test.afterEach(() => {
  resetExtractorMock();
  resetMatcherMock();
  resetVerifierMock();
  resetStrategistMock();
  resetBaselineMock();
});

test('Memory & Resume Pattern Warnings Suite', async (t) => {
  await t.test('Seed historical verifier flags for resume variant', async () => {
    // 2x unsupported flags for "Candidate lacks containerization experience"
    await verifierFlagRepository.createVerifierFlag({
      resumeId,
      claimText: 'Candidate lacks containerization experience',
      flagType: 'unsupported',
    });
    await verifierFlagRepository.createVerifierFlag({
      resumeId,
      claimText: 'Candidate lacks containerization experience',
      flagType: 'unsupported',
    });

    // 1x phrasing_risk flag for "Candidate is completely unqualified in seniority"
    await verifierFlagRepository.createVerifierFlag({
      resumeId,
      claimText: 'Candidate is completely unqualified in seniority',
      flagType: 'phrasing_risk',
    });
  });

  await t.test('getResumePatternWarnings() groups flags by flag_type and frequency', async () => {
    const memory = await getResumePatternWarnings(resumeId);

    assert.equal(memory.resume_id, resumeId);
    assert.equal(memory.total_flags, 3);

    // Unsupported group
    assert.equal(memory.by_flag_type.unsupported.length, 1);
    assert.equal(memory.by_flag_type.unsupported[0].claim_text, 'Candidate lacks containerization experience');
    assert.equal(memory.by_flag_type.unsupported[0].frequency, 2);

    // Phrasing risk group
    assert.equal(memory.by_flag_type.phrasing_risk.length, 1);
    assert.equal(memory.by_flag_type.phrasing_risk[0].claim_text, 'Candidate is completely unqualified in seniority');
    assert.equal(memory.by_flag_type.phrasing_risk[0].frequency, 1);

    // Pattern warnings
    assert.equal(memory.pattern_warnings.length, 2);
    assert.match(memory.pattern_warnings[0].warning, /2 separate analyses/i);
    assert.match(memory.pattern_warnings[1].warning, /1 analysis/i);
  });

  await t.test('GET /resumes/:id/insights exposes pattern warnings with authentication and ownership guards', async () => {
    const res = await fetch(`${baseUrl}/resumes/${resumeId}/insights`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.resume_id, resumeId);
    assert.equal(body.resume_name, 'Full Stack Engineer v2');
    assert.equal(body.total_flags, 3);
    assert.ok(body.by_flag_type);
    assert.ok(Array.isArray(body.pattern_warnings));
  });

  await t.test('GET /resumes/:id/insights returns 404 for unowned resume', async () => {
    const res = await fetch(`${baseUrl}/resumes/${resumeId}/insights`, {
      headers: { Authorization: `Bearer ${user2Token}` },
    });

    assert.equal(res.status, 404);
  });

  await t.test('POST /applications/:id/analyze-v2 surfaces pattern_warnings in agentic_v2 output', async () => {
    setBaselineMock({
      async generateContent() {
        return JSON.stringify({
          fit_score: 75,
          mismatch_reasons: ['Candidate missing Docker'],
        });
      },
    });

    setExtractorMock({
      async generateContent() {
        return JSON.stringify({
          skills: ['Node.js', 'React'],
          years_experience: 4,
          tools: ['PostgreSQL', 'Docker'],
        });
      },
    });

    setMatcherMock({
      async generateContent() {
        return JSON.stringify({
          fit_score: 75,
          mismatch_reasons: ['Candidate missing Docker'],
        });
      },
    });

    setVerifierMock({
      async generateContent() {
        return JSON.stringify({
          verified_score: 85,
          verifications: [
            {
              claim: 'Candidate missing Docker',
              supported: false,
              evidence: 'Docker is in tools',
              flag_type: 'unsupported',
            },
          ],
        });
      },
    });

    setStrategistMock({
      async generateContent() {
        return JSON.stringify({
          overall_recommendation: 'APPLY',
          overall_rationale: 'Fit confirmed',
          actions: [],
        });
      },
    });

    const res = await fetch(`${baseUrl}/applications/${appId}/analyze-v2`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user1Token}` },
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.ok(body.agentic_v2, 'agentic_v2 must be returned');
    assert.ok(Array.isArray(body.agentic_v2.pattern_warnings), 'pattern_warnings must be an array in agentic_v2');
    assert.ok(body.agentic_v2.pattern_warnings.length >= 1);
  });
});
