import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../../src/index.js';
import { pool } from '../../src/db.js';
import {
  extractResumeProfile,
  setCustomAiClient as setExtractorMock,
  resetCustomAiClient as resetExtractorMock,
} from '../../src/services/agentic/extractorService.js';
import {
  matchProfileToJob,
  setCustomAiClient as setMatcherMock,
  resetCustomAiClient as resetMatcherMock,
} from '../../src/services/agentic/matcherService.js';
import {
  verifyMatchAnalysis,
  setCustomAiClient as setVerifierMock,
  resetCustomAiClient as resetVerifierMock,
} from '../../src/services/agentic/verifierService.js';
import {
  determineApplicationStrategy,
  setCustomAiClient as setStrategistMock,
  resetCustomAiClient as resetStrategistMock,
} from '../../src/services/agentic/strategistService.js';
import {
  setCustomAiClient as setBaselineMock,
  resetCustomAiClient as resetBaselineMock,
} from '../../src/services/analysisService.js';
import { runAgenticAnalysis } from '../../src/services/agentic/orchestratorService.js';

let server;
let baseUrl;

test.before(async () => {
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

test.afterEach(() => {
  resetExtractorMock();
  resetMatcherMock();
  resetVerifierMock();
  resetStrategistMock();
  resetBaselineMock();
});

test('Agentic Services Suite - Extractor, Matcher, and Verifier', async (t) => {
  const sampleResume = `
    Full Stack Software Engineer with 4 years experience.
    SKILLS: JavaScript, TypeScript, Python, SQL, REST APIs.
    TOOLS: Node.js, Express, React, PostgreSQL, Docker, Git.
  `;

  const sampleJobDescription = `
    Senior Software Engineer
    Requirements:
    - 5+ years experience with TypeScript and Node.js
    - Experience with PostgreSQL and Docker
    - Experience with AWS cloud infrastructure (ECS, S3, IAM)
  `;

  await t.test('Extractor Service - Successfully extracts structured skills, years, and tools', async () => {
    setExtractorMock({
      async generateContent() {
        return JSON.stringify({
          skills: ['JavaScript', 'TypeScript', 'Python', 'SQL', 'REST APIs'],
          years_experience: 4,
          tools: ['Node.js', 'Express', 'React', 'PostgreSQL', 'Docker', 'Git'],
        });
      },
    });

    const profile = await extractResumeProfile(sampleResume);

    assert.equal(profile.years_experience, 4);
    assert.deepEqual(profile.skills, ['JavaScript', 'TypeScript', 'Python', 'SQL', 'REST APIs']);
    assert.ok(profile.tools.includes('Docker'));
    assert.ok(profile.tools.includes('PostgreSQL'));
  });

  await t.test('Extractor Service - Recovers from malformed JSON via retry', async () => {
    let callCount = 0;
    setExtractorMock({
      async generateContent({ isRetry }) {
        callCount++;
        if (!isRetry) return 'NOT_VALID_JSON';
        return JSON.stringify({
          skills: ['Go', 'Kubernetes'],
          years_experience: 5,
          tools: ['Docker', 'Helm'],
        });
      },
    });

    const profile = await extractResumeProfile(sampleResume);
    assert.equal(callCount, 2);
    assert.equal(profile.years_experience, 5);
  });

  await t.test('Matcher Service - Scores structured profile against JD with compatible contract', async () => {
    const extractedProfile = {
      skills: ['JavaScript', 'TypeScript', 'SQL'],
      years_experience: 4,
      tools: ['Node.js', 'React', 'PostgreSQL', 'Docker'],
    };

    setMatcherMock({
      async generateContent() {
        return JSON.stringify({
          fit_score: 80,
          mismatch_reasons: [
            'Candidate has 4 years experience vs 5+ years required in JD',
            'Missing explicit AWS cloud infrastructure experience (ECS, S3, IAM)',
          ],
        });
      },
    });

    const matchResult = await matchProfileToJob(extractedProfile, sampleJobDescription);

    assert.equal(typeof matchResult.fit_score, 'number');
    assert.equal(matchResult.fit_score, 80);
    assert.ok(Array.isArray(matchResult.mismatch_reasons));
    assert.equal(matchResult.mismatch_reasons.length, 2);
  });

  await t.test('Verifier Service - Correctly flags "unsupported" for false/hallucinated mismatch claims', async () => {
    const claimedMismatches = [
      'Candidate lacks containerization and Docker knowledge',
    ];

    setVerifierMock({
      async generateContent() {
        return JSON.stringify({
          verified_score: 90,
          verifications: [
            {
              claim: 'Candidate lacks containerization and Docker knowledge',
              supported: false,
              evidence: "Resume explicitly lists 'Docker' under TOOLS.",
              flag_type: 'unsupported',
            },
          ],
        });
      },
    });

    const verification = await verifyMatchAnalysis({
      resumeContent: sampleResume,
      jobDescription: sampleJobDescription,
      fitScore: 70,
      mismatchReasons: claimedMismatches,
    });

    assert.equal(verification.verified_score, 90);
    assert.equal(verification.verifications.length, 1);

    const dockerCheck = verification.verifications[0];
    assert.equal(dockerCheck.supported, false);
    assert.equal(dockerCheck.flag_type, 'unsupported', "Genuinely false claim must receive 'unsupported' flag");
    assert.match(dockerCheck.evidence, /Docker/i);
  });

  await t.test('Verifier Service - Correctly flags "phrasing_risk" for exaggerated or misleading wording', async () => {
    const claimedMismatches = [
      'Candidate is completely unqualified and lacks fundamental engineering experience',
    ];

    setVerifierMock({
      async generateContent() {
        return JSON.stringify({
          verified_score: 82,
          verifications: [
            {
              claim: 'Candidate is completely unqualified and lacks fundamental engineering experience',
              supported: true,
              evidence: "Candidate has 4 years of engineering experience (close to 5 years target); calling them 'completely unqualified' is an extreme phrasing risk.",
              flag_type: 'phrasing_risk',
            },
          ],
        });
      },
    });

    const verification = await verifyMatchAnalysis({
      resumeContent: sampleResume,
      jobDescription: sampleJobDescription,
      fitScore: 60,
      mismatchReasons: claimedMismatches,
    });

    assert.equal(verification.verified_score, 82);
    assert.equal(verification.verifications.length, 1);

    const phrasingCheck = verification.verifications[0];
    assert.equal(phrasingCheck.flag_type, 'phrasing_risk', "Misleadingly aggressive claim must receive 'phrasing_risk' flag");
  });

  await t.test('Verifier Service - Handles mixed claims (supported, unsupported, and phrasing_risk)', async () => {
    const claims = [
      'Missing AWS cloud infrastructure experience (ECS, S3, IAM)',
      'Candidate has zero SQL or database knowledge',
      'Candidate does not understand any frontend development',
    ];

    setVerifierMock({
      async generateContent() {
        return JSON.stringify({
          verified_score: 80,
          verifications: [
            {
              claim: 'Missing AWS cloud infrastructure experience (ECS, S3, IAM)',
              supported: true,
              evidence: 'No AWS technologies mentioned anywhere in resume text.',
              flag_type: 'none',
            },
            {
              claim: 'Candidate has zero SQL or database knowledge',
              supported: false,
              evidence: "Resume lists 'SQL' and 'PostgreSQL' explicitly.",
              flag_type: 'unsupported',
            },
            {
              claim: 'Candidate does not understand any frontend development',
              supported: true,
              evidence: "Candidate lists React; however JD is for Senior Backend. Phrasing as 'does not understand frontend' is misleading.",
              flag_type: 'phrasing_risk',
            },
          ],
        });
      },
    });

    const result = await verifyMatchAnalysis({
      resumeContent: sampleResume,
      jobDescription: sampleJobDescription,
      fitScore: 50,
      mismatchReasons: claims,
    });

    assert.equal(result.verified_score, 80);
    assert.equal(result.verifications.length, 3);

    const unsupportedItem = result.verifications.find(v => v.flag_type === 'unsupported');
    const phrasingRiskItem = result.verifications.find(v => v.flag_type === 'phrasing_risk');
    const supportedItem = result.verifications.find(v => v.flag_type === 'none');

    assert.ok(unsupportedItem, 'Must have at least one unsupported item');
    assert.ok(phrasingRiskItem, 'Must have at least one phrasing_risk item');
    assert.ok(supportedItem, 'Must have at least one clean supported item');
  });

  await t.test('Verifier Service - Returns immediate result for empty mismatch reasons', async () => {
    const result = await verifyMatchAnalysis({
      resumeContent: sampleResume,
      jobDescription: sampleJobDescription,
      fitScore: 100,
      mismatchReasons: [],
    });

    assert.equal(result.verified_score, 100);
    assert.deepEqual(result.verifications, []);
  });
});

test('Strategist Service Suite - Decisions & Human Approval Guards', async (t) => {
  const sampleResume = 'Full Stack Engineer with 4 years Node and React.';
  const sampleJD = 'Senior Backend Engineer with 6+ years Go, Kubernetes, and AWS.';

  await t.test('Strategist decides REWRITE_SUGGESTED with requires_human_approval: true', async () => {
    setStrategistMock({
      async generateContent() {
        return JSON.stringify({
          overall_recommendation: 'REVISE_RESUME_FIRST',
          overall_rationale: 'Phrasing risk detected in years of experience.',
          actions: [
            {
              claim: 'Candidate is completely junior and unqualified',
              action: 'REWRITE_SUGGESTED',
              reasoning: 'Candidate has 4 solid years; reframe to emphasize rapid senior-level delivery.',
              suggested_rewrite: 'Engineered scalable backend microservices serving 1M+ requests daily across 4 years of core production engineering.',
              requires_human_approval: true,
            },
          ],
        });
      },
    });

    const res = await determineApplicationStrategy({
      resumeContent: sampleResume,
      jobDescription: sampleJD,
      verifiedScore: 78,
      verifications: [
        {
          claim: 'Candidate is completely junior and unqualified',
          supported: true,
          evidence: 'Candidate has 4 years experience.',
          flag_type: 'phrasing_risk',
        },
      ],
    });

    assert.equal(res.actions.length, 1);
    assert.equal(res.actions[0].action, 'REWRITE_SUGGESTED');
    assert.equal(res.actions[0].requires_human_approval, true);
    assert.ok(res.actions[0].suggested_rewrite);
  });

  await t.test('Strategist decides APPLY_WITH_CAVEAT with requires_human_approval: false', async () => {
    setStrategistMock({
      async generateContent() {
        return JSON.stringify({
          overall_recommendation: 'APPLY_WITH_CAVEAT',
          overall_rationale: 'Missing minor auxiliary tool; safe to proceed with caveat.',
          actions: [
            {
              claim: 'Missing explicit AWS cloud infrastructure experience',
              action: 'APPLY_WITH_CAVEAT',
              reasoning: 'Candidate knows Docker/Postgres; AWS concepts transfer easily.',
              caveat_note: 'Address cloud transferability during phone screen.',
              requires_human_approval: false,
            },
          ],
        });
      },
    });

    const res = await determineApplicationStrategy({
      resumeContent: sampleResume,
      jobDescription: sampleJD,
      verifiedScore: 85,
      verifications: [
        {
          claim: 'Missing explicit AWS cloud infrastructure experience',
          supported: true,
          evidence: 'No AWS in resume',
          flag_type: 'none',
        },
      ],
    });

    assert.equal(res.actions.length, 1);
    assert.equal(res.actions[0].action, 'APPLY_WITH_CAVEAT');
    assert.equal(res.actions[0].requires_human_approval, false);
    assert.ok(res.actions[0].caveat_note);
  });

  await t.test('Strategist decides SKIP_ROLE_RECOMMENDED with requires_human_approval: true', async () => {
    setStrategistMock({
      async generateContent() {
        return JSON.stringify({
          overall_recommendation: 'SKIP_ROLE',
          overall_rationale: 'Fundamental qualification deficit.',
          actions: [
            {
              claim: 'Missing mandatory 6+ years Go distributed consensus experience',
              action: 'SKIP_ROLE_RECOMMENDED',
              reasoning: 'Candidate has zero Go experience for a principal Go role.',
              requires_human_approval: true,
            },
          ],
        });
      },
    });

    const res = await determineApplicationStrategy({
      resumeContent: sampleResume,
      jobDescription: sampleJD,
      verifiedScore: 35,
      verifications: [
        {
          claim: 'Missing mandatory 6+ years Go distributed consensus experience',
          supported: true,
          evidence: 'Candidate is JavaScript/TypeScript only',
          flag_type: 'none',
        },
      ],
    });

    assert.equal(res.actions.length, 1);
    assert.equal(res.actions[0].action, 'SKIP_ROLE_RECOMMENDED');
    assert.equal(res.actions[0].requires_human_approval, true);
  });
});

test('Orchestrator Service Suite - End-to-End Pipeline & Trajectory', async (t) => {
  await t.test('Runs full 4-stage pipeline and logs trajectory with step durations', async () => {
    setExtractorMock({
      async generateContent() {
        return JSON.stringify({
          skills: ['TypeScript', 'Node.js'],
          years_experience: 4,
          tools: ['Docker', 'PostgreSQL'],
        });
      },
    });

    setMatcherMock({
      async generateContent() {
        return JSON.stringify({
          fit_score: 75,
          mismatch_reasons: [
            'Candidate has 4 years experience vs 5+ required',
            'Candidate lacks Docker experience',
          ],
        });
      },
    });

    setVerifierMock({
      async generateContent() {
        return JSON.stringify({
          verified_score: 85,
          verifications: [
            {
              claim: 'Candidate has 4 years experience vs 5+ required',
              supported: true,
              evidence: 'Resume states 4 years',
              flag_type: 'phrasing_risk',
            },
            {
              claim: 'Candidate lacks Docker experience',
              supported: false,
              evidence: 'Resume lists Docker under Tools',
              flag_type: 'unsupported',
            },
          ],
        });
      },
    });

    setStrategistMock({
      async generateContent() {
        return JSON.stringify({
          overall_recommendation: 'APPLY_WITH_CAVEAT',
          overall_rationale: 'Fit score rose after Docker gap was debunked.',
          actions: [
            {
              claim: 'Candidate has 4 years experience vs 5+ required',
              action: 'REWRITE_SUGGESTED',
              reasoning: 'Framing can be improved.',
              suggested_rewrite: 'Highlight rapid execution across 4 intense years.',
              requires_human_approval: true,
            },
          ],
        });
      },
    });

    const result = await runAgenticAnalysis({
      resumeContent: 'Software Engineer with 4 years Node.js and Docker.',
      jobDescription: 'Senior Engineer with 5+ years Node and Docker.',
    });

    assert.equal(result.baseline_score, 75);
    assert.equal(result.verified_score, 85);
    assert.equal(result.verifications.length, 2);
    assert.equal(result.strategist_actions.length, 1);
    assert.equal(result.trajectory.length, 4);

    const steps = result.trajectory.map(t => t.step);
    assert.deepEqual(steps, ['extractor', 'matcher', 'verifier', 'strategist']);

    for (const step of result.trajectory) {
      assert.ok(typeof step.duration_ms === 'number');
      assert.ok(step.input);
      assert.ok(step.output);
    }
  });
});

test('POST /applications/:id/analyze-v2 Route Integration Suite', async (t) => {
  let userToken = '';
  let resumeId = '';
  let appId = '';

  await t.test('Setup test user, resume, and application', async () => {
    const regRes = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `analyze_v2_${Date.now()}@example.com`,
        password: 'password123!',
      }),
    });
    const regData = await regRes.json();
    userToken = regData.token;

    const resRes = await fetch(`${baseUrl}/resumes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        name: 'Backend Specialist',
        content: 'Experienced Node.js, Express, PostgreSQL developer with Docker and 4 years experience.',
      }),
    });
    resumeId = (await resRes.json()).resume.id;

    const appRes = await fetch(`${baseUrl}/applications`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        resume_id: resumeId,
        company_name: 'Stripe',
        role_title: 'Backend Platform Engineer',
        job_description: `Senior Node Developer with 5+ years experience and AWS. (Test Run ${Date.now()})`,
        platform: 'direct',
        applied_at: '2026-08-15',
      }),
    });
    appId = (await appRes.json()).application.id;
  });

  await t.test('POST /applications/:id/analyze-v2 returns side-by-side baseline and agentic_v2 comparison', async () => {
    setBaselineMock({
      async generateContent() {
        return JSON.stringify({
          fit_score: 70,
          mismatch_reasons: ['Baseline missing AWS'],
        });
      },
    });

    setExtractorMock({
      async generateContent() {
        return JSON.stringify({
          skills: ['Node.js', 'PostgreSQL', 'Docker'],
          years_experience: 4,
          tools: ['Express'],
        });
      },
    });

    setMatcherMock({
      async generateContent() {
        return JSON.stringify({
          fit_score: 72,
          mismatch_reasons: ['Missing AWS experience', '4 years vs 5+ years'],
        });
      },
    });

    setVerifierMock({
      async generateContent() {
        return JSON.stringify({
          verified_score: 80,
          verifications: [
            {
              claim: 'Missing AWS experience',
              supported: true,
              evidence: 'No AWS in resume',
              flag_type: 'none',
            },
            {
              claim: '4 years vs 5+ years',
              supported: true,
              evidence: 'Candidate has 4 years',
              flag_type: 'phrasing_risk',
            },
          ],
        });
      },
    });

    setStrategistMock({
      async generateContent() {
        return JSON.stringify({
          overall_recommendation: 'APPLY_WITH_CAVEAT',
          overall_rationale: 'Strong backend fit with minor AWS gap.',
          actions: [
            {
              claim: 'Missing AWS experience',
              action: 'APPLY_WITH_CAVEAT',
              reasoning: 'Candidate has Docker/Postgres background.',
              caveat_note: 'Frame container skills as easily transferable.',
              requires_human_approval: false,
            },
          ],
        });
      },
    });

    const res = await fetch(`${baseUrl}/applications/${appId}/analyze-v2`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` },
    });

    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.message, 'Analysis v2 generated successfully');
    assert.equal(body.application_id, appId);

    // Baseline assertions
    assert.ok(body.baseline, 'Baseline object must be present');
    assert.equal(typeof body.baseline.fit_score, 'number');
    assert.ok(Array.isArray(body.baseline.mismatch_reasons));

    // Agentic v2 assertions
    assert.ok(body.agentic_v2, 'Agentic v2 object must be present');
    assert.equal(body.agentic_v2.baseline_score, 72);
    assert.equal(body.agentic_v2.verified_score, 80);
    assert.equal(body.agentic_v2.verifications.length, 2);
    assert.equal(body.agentic_v2.strategist_actions.length, 1);
    assert.equal(body.agentic_v2.trajectory.length, 4);

    // Trajectory step names check
    const trajectorySteps = body.agentic_v2.trajectory.map(s => s.step);
    assert.deepEqual(trajectorySteps, ['extractor', 'matcher', 'verifier', 'strategist']);
  });
});
