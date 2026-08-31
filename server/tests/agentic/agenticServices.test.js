import test from 'node:test';
import assert from 'node:assert/strict';
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

test.afterEach(() => {
  resetExtractorMock();
  resetMatcherMock();
  resetVerifierMock();
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
    // Scenario: Matcher mistakenly claimed the candidate has no Docker experience,
    // but the raw resume clearly lists Docker.
    const claimedMismatches = [
      'Candidate lacks containerization and Docker knowledge',
    ];

    setVerifierMock({
      async generateContent() {
        return JSON.stringify({
          verified_score: 90, // adjusted upward because the Docker gap was false
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
    // Scenario: Candidate has 4 years experience. Matcher claimed:
    // "Candidate is completely junior and entirely unqualified in seniority."
    // This is technically below 5 years, but phrased as an extreme overclaim.
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
