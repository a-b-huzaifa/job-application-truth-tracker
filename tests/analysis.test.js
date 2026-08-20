import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../src/index.js';
import { pool } from '../src/db.js';
import { setCustomAiClient, resetCustomAiClient } from '../src/services/analysisService.js';
import { hashText } from '../src/services/hashService.js';

let server;
let baseUrl;
let userToken = '';
let userId = '';
let resumeId = '';
let appId1 = '';
let appId2 = '';

const sharedJobDescription = `Senior Backend Engineer (Test Run ${Date.now()})
Requirements:
- 5+ years with Go and Kubernetes
- Experience with Kafka event streaming and Redis caching
- Strong background in distributed transactions and gRPC
`;

test.before(async () => {
  // Start server on an ephemeral port
  await new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });

  // Create user
  const regRes = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `analyzer_${Date.now()}@example.com`,
      password: 'securePassword123!',
    }),
  });
  const regData = await regRes.json();
  userToken = regData.token;
  userId = regData.user.id;

  // Create resume
  const resRes = await fetch(`${baseUrl}/resumes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      name: 'Backend Go Specialist',
      content: 'Experienced Go developer with Docker and Postgres. Learning Kubernetes and Kafka.',
    }),
  });
  const resData = await resRes.json();
  resumeId = resData.resume.id;

  // Create application 1
  const app1Res = await fetch(`${baseUrl}/applications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      resume_id: resumeId,
      company_name: 'CloudScale Inc',
      role_title: 'Senior Backend Engineer',
      job_description: sharedJobDescription,
      platform: 'linkedin',
      applied_at: '2026-08-10',
    }),
  });
  const app1Data = await app1Res.json();
  appId1 = app1Data.application.id;

  // Create application 2 with IDENTICAL job description (to test cross-application caching)
  const app2Res = await fetch(`${baseUrl}/applications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userToken}`,
    },
    body: JSON.stringify({
      resume_id: resumeId,
      company_name: 'AnotherScale Corp',
      role_title: 'Backend Go Engineer',
      job_description: sharedJobDescription,
      platform: 'wellfound',
      applied_at: '2026-08-12',
    }),
  });
  const app2Data = await app2Res.json();
  appId2 = app2Data.application.id;
});

test.after(async () => {
  resetCustomAiClient();
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await pool.end();
});

test('LLM Analysis & Caching Suite', async (t) => {
  let geminiCallCount = 0;

  // Mock Gemini AI Client
  const mockGeminiClient = {
    async generateContent({ isRetry }) {
      geminiCallCount += 1;
      return JSON.stringify({
        fit_score: 75,
        mismatch_reasons: [
          'Candidate has basic Go experience, but lacks 5+ years requirement',
          'Kubernetes and Kafka listed as currently learning rather than production-proven',
        ],
      });
    },
  };

  setCustomAiClient(mockGeminiClient);

  await t.test('POST /applications/:id/analyze - Initial analysis triggers Gemini mock (cache miss)', async () => {
    geminiCallCount = 0;

    const res = await fetch(`${baseUrl}/applications/${appId1}/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.cached, false);
    assert.equal(body.fit_score, 75);
    assert.equal(body.mismatch_reasons.length, 2);
    assert.equal(geminiCallCount, 1, 'Gemini mock must be called exactly once on initial analysis');

    // Verify row persisted in database with SHA-256 hash
    const expectedHash = hashText(sharedJobDescription);
    const dbCheck = await pool.query(
      'SELECT * FROM llm_analyses WHERE job_description_hash = $1',
      [expectedHash]
    );
    assert.equal(dbCheck.rows.length, 1);
    assert.equal(dbCheck.rows[0].fit_score, 75);
  });

  await t.test('POST /applications/:id/analyze - Subsequent analysis of same application returns cached: true without calling Gemini', async () => {
    const previousCallCount = geminiCallCount;

    const res = await fetch(`${baseUrl}/applications/${appId1}/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.cached, true);
    assert.equal(body.fit_score, 75);
    assert.equal(geminiCallCount, previousCallCount, 'Gemini mock must NOT be invoked on cache hit');
  });

  await t.test('POST /applications/:id/analyze - Different application with identical JD reuses cached analysis', async () => {
    const previousCallCount = geminiCallCount;

    const res = await fetch(`${baseUrl}/applications/${appId2}/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.cached, true);
    assert.equal(body.fit_score, 75);
    assert.equal(geminiCallCount, previousCallCount, 'Gemini mock must NOT be called for identical JD hash across different applications');
  });

  await t.test('Retry logic on malformed response - Recovers on retry', async () => {
    let retryAttempts = 0;

    // Create unique JD for retry test
    const retryJobDesc = `Unique Retry Test Role ${Date.now()}`;
    const newAppRes = await fetch(`${baseUrl}/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        resume_id: resumeId,
        company_name: 'Retry Test Corp',
        role_title: 'Test Engineer',
        job_description: retryJobDesc,
        platform: 'direct',
        applied_at: '2026-08-15',
      }),
    });
    const newApp = (await newAppRes.json()).application;

    // Set mock to fail first, then succeed on retry
    setCustomAiClient({
      async generateContent({ isRetry }) {
        retryAttempts += 1;
        if (!isRetry) {
          return 'NOT_VALID_JSON_RESPONSE';
        }
        return JSON.stringify({
          fit_score: 90,
          mismatch_reasons: ['No major mismatches detected'],
        });
      },
    });

    const res = await fetch(`${baseUrl}/applications/${newApp.id}/analyze`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.fit_score, 90);
    assert.equal(body.cached, false);
    assert.equal(retryAttempts, 2, 'Should have made 1 initial call and 1 retry call');
  });
});
