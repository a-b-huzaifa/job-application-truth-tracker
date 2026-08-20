import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../src/index.js';
import { pool } from '../src/db.js';
import { checkForStaleApplications } from '../src/services/staleCheckService.js';
import { startStaleCheckJob, stopStaleCheckJob } from '../src/jobs/staleCheckJob.js';

let server;
let baseUrl;
let userToken = '';
let userId = '';

function daysAgoDate(days) {
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

  // Create test user
  const regRes = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: `stale_user_${Date.now()}@example.com`,
      password: 'password123!',
    }),
  });
  const regData = await regRes.json();
  userToken = regData.token;
  userId = regData.user.id;
});

test.after(async () => {
  stopStaleCheckJob();
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await pool.end();
});

test('Stale Application & Ghosting Detector Suite', async (t) => {
  let staleAppId = '';
  let recentAppId = '';
  let interviewAppId = '';
  let rejectedAppId = '';

  await t.test('Setup test applications with various ages and statuses', async () => {
    // 1. Stale application: applied 25 days ago, status = 'applied'
    const staleRes = await pool.query(
      `INSERT INTO applications (user_id, company_name, role_title, job_description, platform, applied_at, status)
       VALUES ($1, 'StaleCorp', 'Backend Dev', 'Go needed', 'linkedin', $2, 'applied')
       RETURNING id`,
      [userId, daysAgoDate(25)]
    );
    staleAppId = staleRes.rows[0].id;

    // 2. Recent application: applied 5 days ago, status = 'applied'
    const recentRes = await pool.query(
      `INSERT INTO applications (user_id, company_name, role_title, job_description, platform, applied_at, status)
       VALUES ($1, 'RecentCorp', 'Frontend Dev', 'React needed', 'direct', $2, 'applied')
       RETURNING id`,
      [userId, daysAgoDate(5)]
    );
    recentAppId = recentRes.rows[0].id;

    // 3. Old interview application: applied 30 days ago, status = 'interview'
    const interviewRes = await pool.query(
      `INSERT INTO applications (user_id, company_name, role_title, job_description, platform, applied_at, status)
       VALUES ($1, 'InterviewCorp', 'FullStack Dev', 'Node needed', 'wellfound', $2, 'interview')
       RETURNING id`,
      [userId, daysAgoDate(30)]
    );
    interviewAppId = interviewRes.rows[0].id;

    // 4. Old rejected application: applied 40 days ago, status = 'rejected'
    const rejectedRes = await pool.query(
      `INSERT INTO applications (user_id, company_name, role_title, job_description, platform, applied_at, status)
       VALUES ($1, 'RejectCorp', 'DevOps Dev', 'AWS needed', 'micro1', $2, 'rejected')
       RETURNING id`,
      [userId, daysAgoDate(40)]
    );
    rejectedAppId = rejectedRes.rows[0].id;
  });

  await t.test('checkForStaleApplications() flags only 21+ days old applied applications', async () => {
    const summary = await checkForStaleApplications({ userId });

    assert.ok(summary.flagged_as_ghosted >= 1);
    assert.ok(summary.updated_ids.includes(staleAppId));

    // Verify database state for stale app
    const staleDb = await pool.query('SELECT status FROM applications WHERE id = $1', [staleAppId]);
    assert.equal(staleDb.rows[0].status, 'ghosted', 'Stale application must be marked as ghosted');

    // Verify recent app is untouched
    const recentDb = await pool.query('SELECT status FROM applications WHERE id = $1', [recentAppId]);
    assert.equal(recentDb.rows[0].status, 'applied', 'Recent application must remain applied');

    // Verify interview app is untouched
    const interviewDb = await pool.query('SELECT status FROM applications WHERE id = $1', [interviewAppId]);
    assert.equal(interviewDb.rows[0].status, 'interview', 'Interview application must not be changed');

    // Verify rejected app is untouched
    const rejectedDb = await pool.query('SELECT status FROM applications WHERE id = $1', [rejectedAppId]);
    assert.equal(rejectedDb.rows[0].status, 'rejected', 'Rejected application must not be changed');
  });

  await t.test('Running checkForStaleApplications() a second time is idempotent (no duplicate flips)', async () => {
    const secondSummary = await checkForStaleApplications({ userId });
    assert.equal(secondSummary.flagged_as_ghosted, 0, 'No additional applications should be flagged on immediate re-run');
  });

  await t.test('POST /applications/stale-check/run - Manual trigger endpoint functions correctly', async () => {
    // Insert another stale application
    const anotherStaleRes = await pool.query(
      `INSERT INTO applications (user_id, company_name, role_title, job_description, platform, applied_at, status)
       VALUES ($1, 'ManualStaleCorp', 'Staff Dev', 'Rust needed', 'linkedin', $2, 'applied')
       RETURNING id`,
      [userId, daysAgoDate(28)]
    );
    const newStaleId = anotherStaleRes.rows[0].id;

    const res = await fetch(`${baseUrl}/applications/stale-check/run`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.message, 'Stale application check executed successfully');
    assert.ok(body.summary.flagged_as_ghosted >= 1);
    assert.ok(body.updated_ids.includes(newStaleId));

    const checkDb = await pool.query('SELECT status FROM applications WHERE id = $1', [newStaleId]);
    assert.equal(checkDb.rows[0].status, 'ghosted');
  });

  await t.test('startStaleCheckJob & stopStaleCheckJob lifecycle', () => {
    startStaleCheckJob(5000);
    // Calling start again should not create multiple timers
    startStaleCheckJob(5000);
    stopStaleCheckJob();
  });
});
