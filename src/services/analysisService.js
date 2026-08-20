import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import 'dotenv/config';
import { hashText } from './hashService.js';
import analysisRepository from '../repositories/analysisRepository.js';

const analysisSchema = z.object({
  fit_score: z.number().int().min(0).max(100),
  mismatch_reasons: z.array(z.string()),
});

// Helper to extract and parse JSON from LLM response text
function parseAndValidateJson(rawText) {
  let cleaned = rawText.trim();
  // Strip markdown code block wrappers if present (e.g. ```json ... ```)
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  const parsed = JSON.parse(cleaned);
  return analysisSchema.parse(parsed);
}

// Module-level mock override for testing
let customAiClient = null;

export function setCustomAiClient(mockClient) {
  customAiClient = mockClient;
}

export function resetCustomAiClient() {
  customAiClient = null;
}

/**
 * Invokes Gemini AI to evaluate fit between a resume and job description.
 */
async function callGeminiModel(resumeContent, jobDescription, isRetry = false) {
  if (customAiClient) {
    return await customAiClient.generateContent({ resumeContent, jobDescription, isRetry });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = isRetry
    ? `CRITICAL: You MUST return ONLY a valid, raw JSON object (NO markdown, NO extra text).
Evaluate how well the candidate's resume matches the job description.

RESUME:
${resumeContent}

JOB DESCRIPTION:
${jobDescription}

JSON SCHEMA:
{
  "fit_score": <integer between 0 and 100>,
  "mismatch_reasons": [<array of specific strings describing missing qualifications, keyword gaps, or experience shortfalls>]
}`
    : `Compare the following candidate resume against the job description.
Assess the match fidelity, missing skills, and overall qualification fit.

RESUME:
${resumeContent}

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

/**
 * Analyzes fit between a resume and a job description with SHA-256 caching.
 *
 * @param {string|object} resume - Resume content string or resume object containing content
 * @param {string} jobDescription - Full text of the job description
 * @param {string} [applicationId=null] - Application ID to link the analysis to
 * @returns {Promise<{fit_score: number, mismatch_reasons: string[], cached: boolean}>}
 */
export async function analyzeApplicationFit(resume, jobDescription, applicationId = null) {
  const resumeContent = typeof resume === 'object' && resume !== null ? resume.content : resume;

  if (!resumeContent || typeof resumeContent !== 'string') {
    throw new Error('Resume content is required for analysis');
  }
  if (!jobDescription || typeof jobDescription !== 'string') {
    throw new Error('Job description is required for analysis');
  }

  // 1. Compute SHA-256 hash of the job description
  const jdHash = hashText(jobDescription);

  // 2. Check for cached analysis by hash
  const cachedAnalysis = await analysisRepository.getAnalysisByHash(jdHash);
  if (cachedAnalysis) {
    console.log(`[Analysis Cache Hit] Found cached analysis for hash: ${jdHash}`);
    const mismatchReasons = Array.isArray(cachedAnalysis.mismatch_reasons)
      ? cachedAnalysis.mismatch_reasons
      : JSON.parse(cachedAnalysis.mismatch_reasons || '[]');

    return {
      fit_score: cachedAnalysis.fit_score,
      mismatch_reasons: mismatchReasons,
      cached: true,
    };
  }

  console.log(`[Analysis Cache Miss] Invoking LLM for hash: ${jdHash}`);

  // 3. Cache miss: Call Gemini with initial prompt
  let validatedResult = null;
  try {
    const rawOutput = await callGeminiModel(resumeContent, jobDescription, false);
    validatedResult = parseAndValidateJson(rawOutput);
  } catch (initialError) {
    console.warn('[Analysis Warning] Initial LLM parsing/validation failed. Retrying with stricter prompt...', initialError.message);
    // 4. Retry once with stricter prompt
    try {
      const retryOutput = await callGeminiModel(resumeContent, jobDescription, true);
      validatedResult = parseAndValidateJson(retryOutput);
    } catch (retryError) {
      console.error('[Analysis Error] LLM response validation failed on retry:', retryError);
      throw new Error(`Failed to generate valid analysis from LLM: ${retryError.message}`);
    }
  }

  // 5. Store in llm_analyses table
  if (applicationId) {
    await analysisRepository.createAnalysis(
      applicationId,
      validatedResult.fit_score,
      validatedResult.mismatch_reasons,
      jdHash
    );
  }

  // 6. Return response with cached: false
  return {
    fit_score: validatedResult.fit_score,
    mismatch_reasons: validatedResult.mismatch_reasons,
    cached: false,
  };
}

export default {
  analyzeApplicationFit,
  setCustomAiClient,
  resetCustomAiClient,
};
