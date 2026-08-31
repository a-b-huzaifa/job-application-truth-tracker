import http from 'http';

async function request(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed, headers: res.headers });
        } catch {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function runFullSystemCheck() {
  console.log('====================================================');
  console.log('🧪 LIVE SYSTEM VERIFICATION: ALL ENDPOINTS & LOGIC');
  console.log('====================================================\n');

  // 1. Auth Login
  console.log('[1/7] Testing POST /auth/login...');
  const loginRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    },
    { email: 'demo@truth-tracker.io', password: 'password123' }
  );
  if (loginRes.status !== 200 || !loginRes.data.token) {
    throw new Error(`Login failed: ${JSON.stringify(loginRes.data)}`);
  }
  const token = loginRes.data.token;
  console.log(`  ✔ Logged in as ${loginRes.data.user.email} (JWT Token Issued)`);

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 2. Applications Listing
  console.log('[2/7] Testing GET /applications...');
  const appsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/applications',
    method: 'GET',
    headers: authHeaders,
  });
  if (appsRes.status !== 200 || !Array.isArray(appsRes.data.applications)) {
    throw new Error(`Applications query failed: ${JSON.stringify(appsRes.data)}`);
  }
  console.log(`  ✔ Retrieved ${appsRes.data.applications.length} applications from live database`);

  // 3. Resumes Listing
  console.log('[3/7] Testing GET /resumes...');
  const resumesRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/resumes',
    method: 'GET',
    headers: authHeaders,
  });
  if (resumesRes.status !== 200 || !Array.isArray(resumesRes.data.resumes)) {
    throw new Error(`Resumes query failed: ${JSON.stringify(resumesRes.data)}`);
  }
  console.log(`  ✔ Retrieved ${resumesRes.data.resumes.length} candidate resume variants`);

  // 4. Resume Memory Insights
  console.log('[4/7] Testing GET /resumes/:id/insights...');
  const targetResume = resumesRes.data.resumes[0];
  const insightsRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/resumes/${targetResume.id}/insights`,
    method: 'GET',
    headers: authHeaders,
  });
  if (insightsRes.status !== 200) {
    throw new Error(`Insights query failed: ${JSON.stringify(insightsRes.data)}`);
  }
  console.log(`  ✔ Resume Memory Insights retrieved (Flags: ${insightsRes.data.total_flags}, Patterns: ${insightsRes.data.pattern_warnings.length})`);

  // 5. Stale Ghosting Check
  console.log('[5/7] Testing POST /applications/stale-check/run...');
  const staleRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: '/applications/stale-check/run',
    method: 'POST',
    headers: authHeaders,
  });
  if (staleRes.status !== 200) {
    throw new Error(`Stale check failed: ${JSON.stringify(staleRes.data)}`);
  }
  console.log(`  ✔ Stale check executed (Checked: ${staleRes.data.summary.checked}, Flagged Ghosted: ${staleRes.data.summary.flagged_as_ghosted})`);

  // 6. PDF Report Generation
  console.log('[6/7] Testing POST /reports/generate...');
  const reportRes = await request(
    {
      hostname: 'localhost',
      port: 3000,
      path: '/reports/generate',
      method: 'POST',
      headers: authHeaders,
    },
    { period_start: '2026-07-01', period_end: '2026-08-31' }
  );
  if (reportRes.status !== 201 || !reportRes.data.report) {
    throw new Error(`Report generation failed: ${JSON.stringify(reportRes.data)}`);
  }
  console.log(`  ✔ PDF report generated on disk: ${reportRes.data.report.filename}`);

  // 7. PDF Download Verification
  console.log('[7/7] Testing GET /reports/:id/download...');
  const downloadRes = await request({
    hostname: 'localhost',
    port: 3000,
    path: `/reports/${reportRes.data.report.id}/download`,
    method: 'GET',
    headers: authHeaders,
  });
  if (downloadRes.status !== 200 || !downloadRes.headers['content-type'].includes('application/pdf')) {
    throw new Error(`PDF download failed`);
  }
  console.log(`  ✔ PDF binary streamed successfully (Content-Type: application/pdf)`);

  console.log('\n====================================================');
  console.log('🎉 ALL LIVE API & BUSINESS LOGIC CHECKS PASSED 100%!');
  console.log('====================================================');
}

runFullSystemCheck().catch((err) => {
  console.error('System check error:', err);
  process.exit(1);
});
