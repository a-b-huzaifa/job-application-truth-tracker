import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import 'dotenv/config';

export const matchSchema = z.object({
  fit_score: z.number().int().min(0).max(100),
  mismatch_reasons: z.array(z.string()),
});

function parseAndValidateJson(rawText) {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  const parsed = JSON.parse(cleaned);
  return matchSchema.parse(parsed);
}

let customAiClient = null;

export function setCustomAiClient(mockClient) {
  customAiClient = mockClient;
}

export function resetCustomAiClient() {
  customAiClient = null;
}

async function callGeminiMatcher(extractedProfile, jobDescription, isRetry = false) {
  if (customAiClient) {
    return await customAiClient.generateContent({ extractedProfile, jobDescription, isRetry });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

  const profileSummary = JSON.stringify(extractedProfile, null, 2);

  const prompt = isRetry
    ? `CRITICAL: You MUST return ONLY a valid, raw JSON object (NO markdown, NO extra text).
Compare this structured candidate profile against the job description.
Assess the match fidelity, missing skills, and qualification gaps.

STRUCTURED CANDIDATE PROFILE:
${profileSummary}

JOB DESCRIPTION:
${jobDescription}

JSON SCHEMA:
{
  "fit_score": <integer between 0 and 100>,
  "mismatch_reasons": [<array of specific strings describing missing qualifications, keyword gaps, or experience shortfalls>]
}`
    : `Compare the following structured candidate profile against the job description.
Assess the match fidelity, missing competencies, and overall qualification fit.

STRUCTURED CANDIDATE PROFILE:
${profileSummary}

JOB DESCRIPTION:
${jobDescription}

Return your response strictly as a JSON object with this exact structure:
{
  "fit_score": <integer between 0 and 100>,
  "mismatch_reasons": ["specific gap or missing skill 1", "specific gap 2"]
}`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

function fallbackMatch(extractedProfile, jobDescription) {
  const jdText = jobDescription.toLowerCase();
  const allSkills = [...(extractedProfile.skills || []), ...(extractedProfile.tools || [])];
  
  let matches = 0;
  let totalKeywords = 0;
  const missing = [];

  const commonKeywords = ['react', 'node', 'express', 'postgresql', 'typescript', 'python', 'docker', 'kubernetes', 'aws', 'kafka', 'redis', 'c++', 'go', 'embedded'];
  for (const kw of commonKeywords) {
    if (jdText.includes(kw)) {
      totalKeywords++;
      const hasSkill = allSkills.some(s => s.toLowerCase().includes(kw));
      if (hasSkill) {
        matches++;
      } else {
        missing.push(`Role requires ${kw.toUpperCase()} which was not explicitly highlighted in structured skills.`);
      }
    }
  }

  let score = totalKeywords > 0 ? Math.round((matches / totalKeywords) * 100) : 80;
  score = Math.max(15, Math.min(95, score));

  return {
    fit_score: score,
    mismatch_reasons: missing.length > 0 ? missing : ['Candidate profile strongly matches target technical requirements.'],
  };
}

/**
 * Matches a structured candidate profile against a job description.
 * Adheres strictly to the same output contract as analysisService ({ fit_score, mismatch_reasons }).
 *
 * @param {object} extractedProfile - { skills: string[], years_experience: number, tools: string[] }
 * @param {string} jobDescription - Full text of the job description
 * @returns {Promise<{fit_score: number, mismatch_reasons: string[]}>}
 */
export async function matchProfileToJob(extractedProfile, jobDescription) {
  if (!extractedProfile || typeof extractedProfile !== 'object') {
    throw new Error('Structured candidate profile is required for matching');
  }
  if (!jobDescription || typeof jobDescription !== 'string') {
    throw new Error('Job description is required for matching');
  }

  try {
    const rawOutput = await callGeminiMatcher(extractedProfile, jobDescription, false);
    return parseAndValidateJson(rawOutput);
  } catch (initialError) {
    console.warn('[Matcher Warning] Initial matching parse failed. Retrying...', initialError.message);
    try {
      const retryOutput = await callGeminiMatcher(extractedProfile, jobDescription, true);
      return parseAndValidateJson(retryOutput);
    } catch (retryError) {
      console.warn('[Matcher Warning] Gemini API unavailable, applying semantic profile matching fallback.');
      return fallbackMatch(extractedProfile, jobDescription);
    }
  }
}

export default {
  matchProfileToJob,
  matchSchema,
  setCustomAiClient,
  resetCustomAiClient,
};
