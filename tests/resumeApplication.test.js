import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../src/index.js';
import { pool } from '../src/db.js';

let server;
let baseUrl;

let user1Token = '';
let user1Id = '';
let user2Token = '';
let user2Id = '';

let user1ResumeId = '';
let user2ResumeId = '';

let user1AppId = '';

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
  const u1Email = `u1_${Date.now()}@example.com`;
  const reg1Res = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: u1Email, password: 'password123!' }),
  });
  const reg1Data = await reg1Res.json();
  user1Token = reg1Data.token;
  user1Id = reg1Data.user.id;

  // Create User 2
  const u2Email = `u2_${Date.now()}@example.com`;
  const reg2Res = await fetch(`${baseUrl}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: u2Email, password: 'password123!' }),
  });
  const reg2Data = await reg2Res.json();
  user2Token = reg2Data.token;
  user2Id = reg2Data.user.id;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await pool.end();
});

test('Resumes CRUD Suite - Scoped to Authenticated User', async (t) => {
  await t.test('POST /resumes - User 1 creates a resume', async () => {
    const res = await fetch(`${baseUrl}/resumes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        name: 'Full Stack Engineer v1',
        content: 'Experienced in Node, React, PostgreSQL',
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 201);
    assert.ok(body.resume.id);
    assert.equal(body.resume.name, 'Full Stack Engineer v1');
    assert.equal(body.resume.user_id, user1Id);
    user1ResumeId = body.resume.id;
  });

  await t.test('POST /resumes - User 2 creates a resume', async () => {
    const res = await fetch(`${baseUrl}/resumes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user2Token}`,
      },
      body: JSON.stringify({
        name: 'DevOps Specialist v1',
        content: 'Experienced in AWS, Docker, Kubernetes',
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 201);
    assert.ok(body.resume.id);
    assert.equal(body.resume.user_id, user2Id);
    user2ResumeId = body.resume.id;
  });

  await t.test('GET /resumes - Lists only resumes for the authenticated user', async () => {
    const res = await fetch(`${baseUrl}/resumes`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.resumes.length, 1);
    assert.equal(body.resumes[0].id, user1ResumeId);
  });

  await t.test('GET /resumes/:id - Cross-user access returns 404', async () => {
    // User 2 tries to fetch User 1's resume
    const res = await fetch(`${baseUrl}/resumes/${user1ResumeId}`, {
      headers: { Authorization: `Bearer ${user2Token}` },
    });
    const body = await res.json();

    assert.equal(res.status, 404);
    assert.equal(body.error, 'Resume not found');
  });

  await t.test('PATCH /resumes/:id - User 1 updates resume', async () => {
    const res = await fetch(`${baseUrl}/resumes/${user1ResumeId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        name: 'Senior Full Stack Engineer v2',
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.resume.name, 'Senior Full Stack Engineer v2');
  });

  await t.test('PATCH /resumes/:id - Cross-user update returns 404', async () => {
    const res = await fetch(`${baseUrl}/resumes/${user1ResumeId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user2Token}`,
      },
      body: JSON.stringify({
        name: 'Malicious Update',
      }),
    });

    assert.equal(res.status, 404);
  });
});

test('Applications CRUD Suite - Scoped to User & Foreign Key Validations', async (t) => {
  await t.test('POST /applications - Reject application referencing another user resume_id (400)', async () => {
    const res = await fetch(`${baseUrl}/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        resume_id: user2ResumeId, // Belongs to user 2
        company_name: 'Stripe',
        role_title: 'Software Engineer',
        job_description: 'Node.js and React required',
        platform: 'direct',
        applied_at: '2026-08-01',
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 400);
    assert.match(body.error, /does not belong to the user/i);
  });

  await t.test('POST /applications - Successfully create application with own resume', async () => {
    const res = await fetch(`${baseUrl}/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        resume_id: user1ResumeId,
        company_name: 'Vercel',
        role_title: 'Full Stack Engineer',
        job_description: 'Next.js and Edge runtime expertise',
        platform: 'wellfound',
        applied_at: '2026-08-10',
        status: 'applied',
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 201);
    assert.ok(body.application.id);
    assert.equal(body.application.company_name, 'Vercel');
    assert.equal(body.application.status, 'applied');
    user1AppId = body.application.id;
  });

  await t.test('POST /applications - Create second application for filter testing', async () => {
    const res = await fetch(`${baseUrl}/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        company_name: 'Datadog',
        role_title: 'Backend Engineer',
        job_description: 'Distributed systems and Go',
        platform: 'linkedin',
        applied_at: '2026-08-15',
        status: 'interview',
      }),
    });

    assert.equal(res.status, 201);
  });

  await t.test('GET /applications - Filter by status', async () => {
    const res = await fetch(`${baseUrl}/applications?status=interview`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.applications.length, 1);
    assert.equal(body.applications[0].company_name, 'Datadog');
    assert.equal(body.applications[0].status, 'interview');
  });

  await t.test('GET /applications - Filter by platform', async () => {
    const res = await fetch(`${baseUrl}/applications?platform=wellfound`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.applications.length, 1);
    assert.equal(body.applications[0].company_name, 'Vercel');
    assert.equal(body.applications[0].platform, 'wellfound');
  });

  await t.test('GET /applications/:id - Cross-user access returns 404', async () => {
    const res = await fetch(`${baseUrl}/applications/${user1AppId}`, {
      headers: { Authorization: `Bearer ${user2Token}` },
    });
    const body = await res.json();

    assert.equal(res.status, 404);
    assert.equal(body.error, 'Application not found');
  });

  await t.test('PATCH /applications/:id - User 1 updates application status', async () => {
    const res = await fetch(`${baseUrl}/applications/${user1AppId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${user1Token}`,
      },
      body: JSON.stringify({
        status: 'response_received',
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.application.status, 'response_received');
  });

  await t.test('DELETE /applications/:id - Cross-user delete returns 404', async () => {
    const res = await fetch(`${baseUrl}/applications/${user1AppId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${user2Token}` },
    });

    assert.equal(res.status, 404);
  });

  await t.test('DELETE /applications/:id - User 1 deletes application successfully', async () => {
    const res = await fetch(`${baseUrl}/applications/${user1AppId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${user1Token}` },
    });

    assert.equal(res.status, 200);

    // Verify subsequent GET returns 404
    const getRes = await fetch(`${baseUrl}/applications/${user1AppId}`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.equal(getRes.status, 404);
  });

  await t.test('DELETE /resumes/:id - User 1 deletes resume', async () => {
    const res = await fetch(`${baseUrl}/resumes/${user1ResumeId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${user1Token}` },
    });

    assert.equal(res.status, 200);

    const getRes = await fetch(`${baseUrl}/resumes/${user1ResumeId}`, {
      headers: { Authorization: `Bearer ${user1Token}` },
    });
    assert.equal(getRes.status, 404);
  });
});
