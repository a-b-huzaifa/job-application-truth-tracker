import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../src/index.js';
import { pool } from '../src/db.js';

let server;
let baseUrl;

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
});

test.after(async () => {
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await pool.end();
});

test('Auth Suite - Register, Login, and Protected Routes', async (t) => {
  const randomEmail = `test_${Date.now()}@example.com`;
  const password = 'securePassword123!';
  let jwtToken = '';

  await t.test('POST /auth/register - Successfully creates a user and returns a token', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: randomEmail,
        password: password,
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 201);
    assert.ok(body.token, 'Token should be returned on registration');
    assert.equal(body.user.email, randomEmail);
    assert.ok(body.user.id, 'User ID should be returned');
  });

  await t.test('POST /auth/register - Rejects duplicate email with 409', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: randomEmail,
        password: password,
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 409);
    assert.match(body.error, /already in use/i);
  });

  await t.test('POST /auth/register - Rejects invalid payload with 400', async () => {
    const res = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'not-an-email',
        password: '123',
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 400);
    assert.ok(body.details, 'Validation details should be provided');
  });

  await t.test('POST /auth/login - Valid credentials returns a valid JWT', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: randomEmail,
        password: password,
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.ok(body.token, 'Token should be returned on login');
    assert.equal(body.user.email, randomEmail);

    jwtToken = body.token;
  });

  await t.test('POST /auth/login - Wrong password returns 401 with generic error message', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: randomEmail,
        password: 'incorrectPassword999!',
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 401);
    assert.equal(body.error, 'Invalid credentials');
  });

  await t.test('POST /auth/login - Non-existent email returns 401 with generic error message', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ghost_user_999@example.com',
        password: password,
      }),
    });

    const body = await res.json();
    assert.equal(res.status, 401);
    assert.equal(body.error, 'Invalid credentials');
  });

  await t.test('Protected Route - Missing token returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/protected`);
    const body = await res.json();

    assert.equal(res.status, 401);
    assert.match(body.error, /Missing Authorization header/i);
  });

  await t.test('Protected Route - Invalid token returns 401 Unauthorized', async () => {
    const res = await fetch(`${baseUrl}/protected`, {
      headers: {
        Authorization: 'Bearer invalid.token.payload',
      },
    });
    const body = await res.json();

    assert.equal(res.status, 401);
    assert.match(body.error, /Invalid or expired token/i);
  });

  await t.test('Protected Route - Valid token returns 200 and grants access', async () => {
    const res = await fetch(`${baseUrl}/protected`, {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.message, 'Access granted to protected resource');
    assert.ok(body.userId, 'userId must be attached to request');
  });

  await t.test('GET /auth/me - Valid token returns user profile', async () => {
    const res = await fetch(`${baseUrl}/auth/me`, {
      headers: {
        Authorization: `Bearer ${jwtToken}`,
      },
    });
    const body = await res.json();

    assert.equal(res.status, 200);
    assert.equal(body.user.email, randomEmail);
    assert.equal(body.user.password_hash, undefined, 'password_hash must not be exposed');
  });
});
