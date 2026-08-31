import { extractResumeProfile } from './extractorService.js';
import { matchProfileToJob } from './matcherService.js';
import { verifyMatchAnalysis } from './verifierService.js';
import { determineApplicationStrategy } from './strategistService.js';

/**
 * Orchestrates the full 4-stage Agentic analysis pipeline:
 * Extractor -> Matcher -> Verifier -> Strategist
 *
 * Logs step execution metadata and returns structured findings.
 *
 * @param {object} params
 * @param {string} params.resumeContent - Raw resume content string
 * @param {string} params.jobDescription - Raw job description text
 * @returns {Promise<{
 *   baseline_score: number,
 *   verified_score: number,
 *   mismatch_reasons: string[],
 *   verifications: Array<object>,
 *   strategist_actions: Array<object>,
 *   overall_strategy: object,
 *   trajectory: Array<{step: string, input: any, output: any, duration_ms: number}>
 * }>}
 */
export async function runAgenticAnalysis({ resumeContent, jobDescription }) {
  if (!resumeContent || typeof resumeContent !== 'string') {
    throw new Error('Resume content is required for agentic analysis');
  }
  if (!jobDescription || typeof jobDescription !== 'string') {
    throw new Error('Job description is required for agentic analysis');
  }

  const trajectory = [];

  // Stage 1: Extractor Agent
  const t0 = Date.now();
  const extractedProfile = await extractResumeProfile(resumeContent);
  const durExtractor = Date.now() - t0;
  trajectory.push({
    step: 'extractor',
    input: { resume_length: resumeContent.length },
    output: extractedProfile,
    duration_ms: durExtractor,
  });

  // Stage 2: Matcher Agent
  const t1 = Date.now();
  const matchResult = await matchProfileToJob(extractedProfile, jobDescription);
  const durMatcher = Date.now() - t1;
  trajectory.push({
    step: 'matcher',
    input: {
      profile_summary: {
        skills_count: extractedProfile.skills?.length || 0,
        years_experience: extractedProfile.years_experience || 0,
      },
      jd_length: jobDescription.length,
    },
    output: matchResult,
    duration_ms: durMatcher,
  });

  const baselineScore = matchResult.fit_score;
  const mismatchReasons = matchResult.mismatch_reasons || [];

  // Stage 3: Verifier Agent
  const t2 = Date.now();
  const verificationResult = await verifyMatchAnalysis({
    resumeContent,
    jobDescription,
    fitScore: baselineScore,
    mismatchReasons,
  });
  const durVerifier = Date.now() - t2;
  trajectory.push({
    step: 'verifier',
    input: {
      initial_fit_score: baselineScore,
      claims_count: mismatchReasons.length,
    },
    output: verificationResult,
    duration_ms: durVerifier,
  });

  const verifiedScore = verificationResult.verified_score;
  const verifications = verificationResult.verifications || [];

  // Stage 4: Strategist Agent
  const t3 = Date.now();
  const strategyResult = await determineApplicationStrategy({
    resumeContent,
    jobDescription,
    verifiedScore,
    verifications,
  });
  const durStrategist = Date.now() - t3;
  trajectory.push({
    step: 'strategist',
    input: {
      verified_score: verifiedScore,
      verifications_count: verifications.length,
    },
    output: strategyResult,
    duration_ms: durStrategist,
  });

  return {
    baseline_score: baselineScore,
    verified_score: verifiedScore,
    mismatch_reasons: mismatchReasons,
    verifications: verifications,
    strategist_actions: strategyResult.actions,
    overall_strategy: {
      recommendation: strategyResult.overall_recommendation,
      rationale: strategyResult.overall_rationale,
    },
    trajectory: trajectory,
  };
}

export default {
  runAgenticAnalysis,
};
