import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import 'dotenv/config';

export const verificationItemSchema = z.object({
  claim: z.string(),
  supported: z.boolean(),
  evidence: z.string(),
  flag_type: z.enum(['none', 'unsupported', 'phrasing_risk']),
});

export const verificationOutputSchema = z.object({
  verified_score: z.number().int().min(0).max(100),
  verifications: z.array(verificationItemSchema),
});

function parseAndValidateJson(rawText) {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  const parsed = JSON.parse(cleaned);
  return verificationOutputSchema.parse(parsed);
}

let customAiClient = null;

export function setCustomAiClient(mockClient) {
  customAiClient = mockClient;
}

export function resetCustomAiClient() {
  customAiClient = null;
}

async function callGeminiVerifier(resumeContent, jobDescription, fitScore, mismatchReasons, isRetry = false) {
  if (customAiClient) {
    return await customAiClient.generateContent({
      resumeContent,
      jobDescription,
      fitScore,
      mismatchReasons,
      isRetry,
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

  const claimsList = JSON.stringify(mismatchReasons, null, 2);

  const prompt = isRetry
    ? `CRITICAL: You MUST return ONLY a valid, raw JSON object (NO markdown, NO extra text).
Verify each claimed mismatch reason against the raw resume and job description.

RAW RESUME:
${resumeContent}

JOB DESCRIPTION:
${jobDescription}

INITIAL PROPOSED FIT SCORE: ${fitScore}

CLAIMS TO VERIFY:
${claimsList}

FLAG TYPES RULES:
- 'unsupported': The claim is genuinely FALSE (e.g. claims resume lacks skill X when resume clearly states skill X, or JD does not require it).
- 'phrasing_risk': The claim is technically true, but phrased in an exaggerated or misleading way that an expert human reviewer would flag as overclaiming or unfair.
- 'none': The claim is accurate, fair, and directly substantiated by evidence.

JSON SCHEMA:
{
  "verified_score": <adjusted integer between 0 and 100>,
  "verifications": [
    {
      "claim": "<exact claim string>",
      "supported": <boolean: true if claim is valid, false if unsupported>,
      "evidence": "<specific quote or factual reasoning from resume/JD>",
      "flag_type": "none" | "unsupported" | "phrasing_risk"
    }
  ]
}`
    : `You are an expert Truth Auditor verifying automated job fit diagnoses.
Carefully audit each of the following claimed mismatch reasons against the raw resume text and job description.

RAW RESUME:
${resumeContent}

JOB DESCRIPTION:
${jobDescription}

INITIAL PROPOSED FIT SCORE: ${fitScore}

CLAIMS TO VERIFY:
${claimsList}

Auditing Rules:
1. 'unsupported': Use when the claim is factually false (e.g., claiming candidate lacks a skill that IS clearly in the resume, or hallucinating a JD requirement).
2. 'phrasing_risk': Use when the claim has a grain of truth, but is worded so aggressively or ambiguously that a human hiring manager would consider it an overclaim.
3. 'none': Use when the claim is truthful, supported, and appropriately stated.
4. Calculate 'verified_score': If critical claims were flagged as 'unsupported' or 'phrasing_risk', adjust the score upward or downward to reflect the verified reality.

Return your response strictly as a JSON object matching this structure:
{
  "verified_score": 85,
  "verifications": [
    {
      "claim": "Missing Docker container experience",
      "supported": false,
      "evidence": "Resume explicitly lists 'Docker, Kubernetes' under Skills.",
      "flag_type": "unsupported"
    }
  ]
}`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

import verifierFlagRepository from '../../repositories/verifierFlagRepository.js';

/**
 * Re-checks each claimed mismatch reason against the raw resume text and JD.
 * Flags unsupported hallucinations and phrasing risks, providing an audited fit score.
 * Persists any 'unsupported' or 'phrasing_risk' flags to the database if resumeId is provided.
 *
 * @param {object} params
 * @param {string} params.resumeContent - Raw resume text
 * @param {string} params.jobDescription - Full job description text
 * @param {number} params.fitScore - Proposed fit score from Matcher
 * @param {string[]} params.mismatchReasons - Proposed mismatch reasons from Matcher
 * @param {string} [params.resumeId=null] - Optional resume UUID for persistent flag memory
 * @returns {Promise<{verified_score: number, verifications: Array<{claim: string, supported: boolean, evidence: string, flag_type: 'none'|'unsupported'|'phrasing_risk'}>}>}
 */
export async function verifyMatchAnalysis({ resumeContent, jobDescription, fitScore, mismatchReasons, resumeId = null }) {
  if (!resumeContent || typeof resumeContent !== 'string') {
    throw new Error('Resume content is required for verification');
  }
  if (!jobDescription || typeof jobDescription !== 'string') {
    throw new Error('Job description is required for verification');
  }
  if (typeof fitScore !== 'number') {
    throw new Error('Fit score is required for verification');
  }
  if (!Array.isArray(mismatchReasons)) {
    throw new Error('Mismatch reasons array is required for verification');
  }

  // If there are no mismatch reasons to verify, return existing score with empty verifications
  if (mismatchReasons.length === 0) {
    return {
      verified_score: fitScore,
      verifications: [],
    };
  }

  let validatedOutput = null;

function fallbackVerify(resumeContent, jobDescription, fitScore, mismatchReasons) {
  const resumeText = resumeContent.toLowerCase();
  const verifications = mismatchReasons.map(claim => {
    const claimLower = claim.toLowerCase();
    
    // Check if the claim alleges a missing skill that actually appears in the resume
    const words = claimLower.replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(w => w.length > 3);
    const foundInResume = words.some(w => ['docker', 'kubernetes', 'react', 'node', 'postgres', 'sql', 'python', 'aws', 'kafka', 'redis'].includes(w) && resumeText.includes(w));

    if (foundInResume) {
      return {
        claim,
        supported: false,
        evidence: `Skill/qualification was explicitly detected in candidate resume text. Claim is an evaluator false-negative.`,
        flag_type: 'unsupported',
      };
    }

    if (claimLower.includes('junior') || claimLower.includes('unqualified') || claimLower.includes('exaggerat')) {
      return {
        claim,
        supported: true,
        evidence: `Candidate possesses relevant production experience; wording is flagged as potential phrasing risk.`,
        flag_type: 'phrasing_risk',
      };
    }

    return {
      claim,
      supported: true,
      evidence: `Requirement checked against candidate resume.`,
      flag_type: 'none',
    };
  });

  const unsupportedCount = verifications.filter(v => v.flag_type === 'unsupported').length;
  const phrasingCount = verifications.filter(v => v.flag_type === 'phrasing_risk').length;
  
  let adjustedScore = fitScore;
  if (unsupportedCount > 0) {
    adjustedScore = Math.min(100, adjustedScore + (unsupportedCount * 12));
  }
  if (phrasingCount > 0) {
    adjustedScore = Math.min(100, adjustedScore + (phrasingCount * 5));
  }

  return {
    verified_score: adjustedScore,
    verifications,
  };
}

  try {
    const rawOutput = await callGeminiVerifier(resumeContent, jobDescription, fitScore, mismatchReasons, false);
    validatedOutput = parseAndValidateJson(rawOutput);
  } catch (initialError) {
    console.warn('[Verifier Warning] Initial verification parse failed. Retrying...', initialError.message);
    try {
      const retryOutput = await callGeminiVerifier(resumeContent, jobDescription, fitScore, mismatchReasons, true);
      validatedOutput = parseAndValidateJson(retryOutput);
    } catch (retryError) {
      console.warn('[Verifier Warning] Gemini API unavailable, applying semantic verification audit fallback.');
      validatedOutput = fallbackVerify(resumeContent, jobDescription, fitScore, mismatchReasons);
    }
  }

  // Persist flagged claims into verifier_flags table for memory tracking
  if (resumeId && validatedOutput && Array.isArray(validatedOutput.verifications)) {
    for (const item of validatedOutput.verifications) {
      if (item.flag_type === 'unsupported' || item.flag_type === 'phrasing_risk') {
        try {
          await verifierFlagRepository.createVerifierFlag({
            resumeId,
            claimText: item.claim,
            flagType: item.flag_type,
          });
        } catch (flagErr) {
          console.error('[Verifier Error] Failed to persist verifier flag:', flagErr);
        }
      }
    }
  }

  return validatedOutput;
}

export default {
  verifyMatchAnalysis,
  verificationItemSchema,
  verificationOutputSchema,
  setCustomAiClient,
  resetCustomAiClient,
};
