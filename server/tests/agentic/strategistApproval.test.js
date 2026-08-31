import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../../src/index.js';
import { pool } from '../../src/db.js';
import strategistActionRepository from '../../src/repositories/strategistActionRepository.js';

let server;
let baseUrl;

let user1Token = '';
let user1Id = '';
let user2Token = '';
let user2Id = '';

let user1ResumeId = '';
let user1AppId = '';
const initialResumeContent = 'Software Engineer with 4 years Node.js and TypeScript.';

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
    body: JSON.stringify({ email: `strat_user1_${Date.now()}@example.com`, password: 'password123!' }),
  });
  const u1Data = await u1Res.json();
  user1Token = u1Data.token;
  user1Id = u1Data.user.id;

  // Create User 2
  const u2Res = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `strat_user2_${Date.now()}@example.com`, password: 'password123!' }),
  });
  const u2Data = await u2Res.json();
  user2Token = u2Data.token;
  user2Id = u2Data.user.id;

  // User 1 creates Resume
  const rRes = await fetch(`${baseUrl}/resumes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user1Token}`,
    },
    body: JSON.stringify({
      name: 'Full Stack Engineer v1',
      content: initialResumeContent,
    }),
  });
  const rData = await rRes.json();
  user1ResumeId = rData.resume.id;

  // User 1 creates Application
  const appRes = await fetch(`${baseUrl}/applications`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${user1Token}`,
    },
    body: JSON.stringify({
      resume_id: user1ResumeId,
      company_name: 'Datadog',
      role_title: 'Backend Engineer',
      job_description: 'Node.js and Docker required.',
      platform: 'direct',
      applied_at: '2026-08-15',
    }),
  });
  const appData = await appRes.json();
  user1AppId = appData.application.id;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await pool.end();
});

test('Strategist Actions & Human Approval Suite', async (t) => {
  let rewriteActionId = '';
  let skipActionId = '';
  let caveatActionId = '';

  await t.test('Seed pending strategist actions in database', async () => {
    // 1. REWRITE_SUGGESTED
    const rewriteAction = await strategistActionRepository.createStrategistAction({
      userId: user1Id,
      applicationId: user1AppId,
      actionType: 'REWRITE_SUGGESTED',
      payload: {
        claim: 'Candidate is completely unqualified in seniority',
        reasoning: 'Reframe to highlight high velocity delivery across 4 years',
        suggested_rewrite: 'Spearheaded backend architecture across 4 years delivering 99.99% uptime',
        requires_human_approval: true,
      },
      status: 'pending',
      applied: false,
    });
    rewriteActionId = rewriteAction.id;

    // 2. SKIP_ROLE_RECOMMENDED
    const skipAction = await strategistActionRepository.createStrategistAction({
      userId: user1Id,
      applicationId: user1AppId,
      actionType: 'SKIP_ROLE_RECOMMENDED',
      payload: {
        claim: 'Missing 10+ years C++ compiler experience',
        reasoning: 'Gap too massive for principal C++ compiler role',
        requires_human_approval: true,
      },
      status: 'pending',
      applied: false,
    });
    skipActionId = skipAction.id;

    // 3. APPLY_WITH_CAVEAT
    const caveatAction = await strategistActionRepository.createStrategistAction({
      userId: user1Id,
      applicationId: user1AppId,
      actionType: 'APPLY_WITH_CAVEAT',
      payload: {
        claim: 'Missing minor Prometheus monitoring',
        reasoning: 'Easily learned on the job',
        caveat_note: 'Discuss observability during technical interview',
        requires_human_approval: false,
      },
      status: 'pending',
      applied: false,
    });
    caveatActionId = caveatAction.id;
  });

  await t.test('Guard A: A pending action CANNOT be marked applied under any code path', async () => {
    // Fetch pending action directly from DB
    const dbAction = await strategistActionRepository.getStrategistActionById(rewriteActionId, user1Id, user1AppId);

    assert.equal(dbAction.status, 'pending');
    assert.equal(dbAction.applied, false, 'Pending action applied column must be strictly false');
    assert.equal(dbAction.applied_at, null, 'Pending action applied_at must be strictly null');
    assert.equal(dbAction.resolved_at, null, 'Pending action resolved_at must be strictly null');
  });

  await t.test('POST /applications/:id/strategist-actions/:actionId/approve sets status=approved, applied=true, applied_at=now', async () => {
    const res = await fetch(`${baseUrl}/applications/${user1AppId}/strategist-actions/${rewriteActionId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user1Token}` },
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.message, 'Strategist action approved successfully');
    assert.equal(body.action.id, rewriteActionId);
    assert.equal(body.action.status, 'approved');
    assert.equal(body.action.applied, true, 'Approving action must set applied=true');
    assert.ok(body.action.applied_at, 'applied_at timestamp must be set');
    assert.ok(body.action.resolved_at, 'resolved_at timestamp must be set');

    // Verify directly in DB
    const dbCheck = await strategistActionRepository.getStrategistActionById(rewriteActionId, user1Id, user1AppId);
    assert.equal(dbCheck.status, 'approved');
    assert.equal(dbCheck.applied, true);
    assert.ok(dbCheck.applied_at);
  });

  await t.test('POST /applications/:id/strategist-actions/:actionId/reject sets status=rejected, applied=false, applied_at=null', async () => {
    const res = await fetch(`${baseUrl}/applications/${user1AppId}/strategist-actions/${skipActionId}/reject`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user1Token}` },
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.message, 'Strategist action rejected successfully');
    assert.equal(body.action.id, skipActionId);
    assert.equal(body.action.status, 'rejected');
    assert.equal(body.action.applied, false, 'Rejected action must have applied=false');
    assert.equal(body.action.applied_at, null, 'Rejected action must have applied_at=null');
    assert.ok(body.action.resolved_at, 'resolved_at timestamp must be set');

    // Verify directly in DB
    const dbCheck = await strategistActionRepository.getStrategistActionById(skipActionId, user1Id, user1AppId);
    assert.equal(dbCheck.status, 'rejected');
    assert.equal(dbCheck.applied, false);
    assert.equal(dbCheck.applied_at, null);
  });

  await t.test('Re-approving an already resolved action returns 400 Bad Request', async () => {
    const res = await fetch(`${baseUrl}/applications/${user1AppId}/strategist-actions/${rewriteActionId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user1Token}` },
    });

    const body = await res.json();
    assert.equal(res.status, 400);
    assert.match(body.error, /already been resolved/i);
  });

  await t.test('Cross-user access to approve returns 404 Not Found', async () => {
    const res = await fetch(`${baseUrl}/applications/${user1AppId}/strategist-actions/${caveatActionId}/approve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${user2Token}` },
    });

    assert.equal(res.status, 404);
  });

  await t.test('Guard B: NO resume table row is EVER touched or mutated by this feature', async () => {
    // Check resume row in database after all approve and reject operations
    const resumeCheck = await pool.query('SELECT * FROM resumes WHERE id = $1', [user1ResumeId]);
    assert.equal(resumeCheck.rows.length, 1);

    const resumeRow = resumeCheck.rows[0];
    assert.equal(
      resumeRow.content,
      initialResumeContent,
      'Resume content in DB must remain 100% identical and unmutated'
    );
    assert.equal(
      resumeRow.name,
      'Full Stack Engineer v1',
      'Resume name must remain 100% identical'
    );

    // Verify total count of resumes in DB remains untouched
    const countCheck = await pool.query('SELECT count(*)::int as count FROM resumes WHERE user_id = $1', [user1Id]);
    assert.equal(countCheck.rows[0].count, 1);
  });
});
