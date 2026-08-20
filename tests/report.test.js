import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import fs from 'fs';
import app from '../src/index.js';
import { pool } from '../src/db.js';
import { buildReportData } from '../src/services/reportDataService.js';
import { generateReportPDF } from '../src/services/pdfReportService.js';

let server;
let baseUrl;
let user1Token = '';
let user1Id = '';
let user2Token = '';
let user2Id = '';

let resume1Id = '';
let resume2Id = '';
let createdReportId = '';

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

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

  // Create User 1
  const u1Res = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `reporter1_${Date.now()}@example.com`, password: 'password123!' }),
  });
  const u1Data = await u1Res.json();
  user1Token = u1Data.token;
  user1Id = u1Data.user.id;

  // Create User 2
  const u2Res = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `reporter2_${Date.now()}@example.com`, password: 'password123!' }),
  });
  const u2Data = await u2Res.json();
  user2Token = u2Data.token;
  user2Id = u2Data.user.id;

  // Create 2 Resumes for User 1
  const r1Res = await fetch(`${baseUrl}/resumes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user1Token}` },
    body: JSON.stringify({ name: 'TypeScript FullStack', content: 'Node, React, Postgres' }),
  });
  resume1Id = (await r1Res.json()).resume.id;

  const r2Res = await fetch(`${baseUrl}/resumes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user1Token}` },
    body: JSON.stringify({ name: 'Go Backend Specialist', content: 'Go, Kafka, Redis' }),
  });
  resume2Id = (await r2Res.json()).resume.id;

  // Seed controlled applications for User 1 within last 30 days:
  // Resume 1 (TypeScript): 4 applications -> 2 responses ('interview', 'response_received'), 1 rejected, 1 applied -> 50% response rate
  await pool.query(`
    INSERT INTO applications (user_id, resume_id, company_name, role_title, job_description, platform, applied_at, status)
    VALUES 
      ($1, $2, 'AppA', 'Dev1', 'JD1', 'linkedin', $3, 'interview'),
      ($1, $2, 'AppB', 'Dev2', 'JD2', 'linkedin', $4, 'response_received'),
      ($1, $2, 'AppC', 'Dev3', 'JD3', 'direct', $5, 'rejected'),
      ($1, $2, 'AppD', 'Dev4', 'JD4', 'wellfound', $6, 'applied')
  `, [user1Id, resume1Id, daysAgo(5), daysAgo(8), daysAgo(12), daysAgo(15)]);

  // Resume 2 (Go): 2 applications (low sample size < 3) -> 0 responses (1 ghosted, 1 rejected) -> 0% response rate
  await pool.query(`
    INSERT INTO applications (user_id, resume_id, company_name, role_title, job_description, platform, applied_at, status)
    VALUES 
      ($1, $2, 'AppE', 'GoDev1', 'JD5', 'direct', $3, 'ghosted'),
      ($1, $2, 'AppF', 'GoDev2', 'JD6', 'micro1', $4, 'rejected')
  `, [user1Id, resume2Id, daysAgo(20), daysAgo(25)]);
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await pool.end();
});

test('Report Generation & PDF Export Suite', async (t) => {
  await t.test('buildReportData() correctly computes metrics and response rates by resume', async () => {
    const periodStart = daysAgo(30);
    const periodEnd = daysAgo(0);

    const data = await buildReportData(user1Id, periodStart, periodEnd);

    assert.equal(data.summary.total_applications, 6);
    assert.equal(data.summary.responses, 2); // 1 interview + 1 response_received
    assert.equal(data.summary.rejections, 2);
    assert.equal(data.summary.ghosted, 1);
    assert.equal(data.summary.response_rate, 33.3); // 2/6 = 33.3%

    // Verify Resume 1 (TypeScript)
    const r1Data = data.resumes.find(r => r.resume_id === resume1Id);
    assert.ok(r1Data);
    assert.equal(r1Data.total, 4);
    assert.equal(r1Data.responses, 2);
    assert.equal(r1Data.response_rate, 50.0);
    assert.equal(r1Data.low_sample_size, false, 'Resume 1 with 4 applications has adequate sample size');

    // Verify Resume 2 (Go Backend)
    const r2Data = data.resumes.find(r => r.resume_id === resume2Id);
    assert.ok(r2Data);
    assert.equal(r2Data.total, 2);
    assert.equal(r2Data.responses, 0);
    assert.equal(r2Data.response_rate, 0.0);
    assert.equal(r2Data.low_sample_size, true, 'Resume 2 with 2 applications must be flagged as low sample size');

    // Verify sorting: highest response rate first
    assert.equal(data.resumes[0].resume_id, resume1Id);
  });

  await t.test('POST /reports/generate creates a real PDF file on disk and returns metadata', async () => {
    const res = await fetch(`${baseUrl}/reports/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        period_start: daysAgo(30),
        period_end: daysAgo(0),
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 201);
    assert.ok(body.report.id);
    assert.ok(body.report.download_url);
    assert.equal(body.summary.total_applications, 6);
    assert.equal(body.summary.response_rate, 33.3);

    createdReportId = body.report.id;

    // Verify file on disk
    const dbRecord = await pool.query('SELECT file_path FROM weekly_reports WHERE id = $1', [createdReportId]);
    assert.ok(dbRecord.rows.length > 0);
    const filePath = dbRecord.rows[0].file_path;
    assert.ok(fs.existsSync(filePath), 'Generated PDF file must exist on disk');
    const stat = fs.statSync(filePath);
    assert.ok(stat.size > 500, 'PDF file must be non-empty and well-formed');
  });

  await t.test('GET /reports - Lists user reports', async () => {
    const res = await fetch(`${baseUrl}/reports`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.ok(Array.isArray(body.reports));
    assert.ok(body.reports.length >= 1);
    assert.equal(body.reports[0].id, createdReportId);
  });

  await t.test('GET /reports/:id/download - Streams the PDF file with correct content headers', async () => {
    const res = await fetch(`${baseUrl}/reports/${createdReportId}/download`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'application/pdf');
    assert.match(res.headers.get('content-disposition'), /attachment; filename="truth_report/);

    const buffer = await res.arrayBuffer();
    assert.ok(buffer.byteLength > 500, 'Downloaded stream must contain full PDF bytes');
  });

  await t.test('GET /reports/:id/download - Non-existent report ID returns 404', async () => {
    const res = await fetch(`${baseUrl}/reports/00000000-0000-0000-0000-000000000000/download`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.equal(res.status, 404);
  });

  await t.test('GET /reports/:id/download - Cross-user access returns 404', async () => {
    // User 2 tries to download User 1's report
    const res = await fetch(`${baseUrl}/reports/${createdReportId}/download`, {
      headers: { Authorization: `Bearer ${user2Token}` },
    });
    assert.equal(res.status, 404);
  });

  await t.test('Report with low sample size generates without crashing', async () => {
    // Generate for User 2 who has 0 applications
    const res = await fetch(`${baseUrl}/reports/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user2Token}`,
      },
      body: JSON.stringify({
        period_start: daysAgo(7),
        period_end: daysAgo(0),
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 201);
    assert.equal(body.summary.total_applications, 0);
  });
});
