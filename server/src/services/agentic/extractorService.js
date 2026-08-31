import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import 'dotenv/config';

export const extractionSchema = z.object({
  skills: z.array(z.string()).default([]),
  years_experience: z.number().nonnegative().default(0),
  tools: z.array(z.string()).default([]),
});

function parseAndValidateJson(rawText) {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  const parsed = JSON.parse(cleaned);
  return extractionSchema.parse(parsed);
}

let customAiClient = null;

export function setCustomAiClient(mockClient) {
  customAiClient = mockClient;
}

export function resetCustomAiClient() {
  customAiClient = null;
}

async function callGeminiExtractor(resumeContent, isRetry = false) {
  if (customAiClient) {
    return await customAiClient.generateContent({ resumeContent, isRetry });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = isRetry
    ? `CRITICAL: You MUST return ONLY a valid, raw JSON object (NO markdown, NO extra text).
Extract candidate skills, years of experience, and software tools from this resume.

RESUME:
${resumeContent}

JSON SCHEMA:
{
  "skills": [<array of skill strings>],
  "years_experience": <number representing total years of experience, 0 if not discernable>,
  "tools": [<array of frameworks, libraries, cloud tools, databases, developer tools>]
}`
    : `Extract structured profile information from this candidate resume.
Identify key core competencies/skills, total estimated years of relevant professional experience, and tools/technologies.

RESUME:
${resumeContent}

Return your response strictly as a JSON object with this exact structure:
{
  "skills": ["JavaScript", "TypeScript", "System Design"],
  "years_experience": 4,
  "tools": ["React", "PostgreSQL", "Docker", "AWS"]
}`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Extracts structured skills, years of experience, and tools from raw resume text.
 *
 * @param {string} resumeContent - Raw resume text
 * @returns {Promise<{skills: string[], years_experience: number, tools: string[]}>}
 */
export async function extractResumeProfile(resumeContent) {
  if (!resumeContent || typeof resumeContent !== 'string') {
    throw new Error('Resume content is required for extraction');
  }

  try {
    const rawOutput = await callGeminiExtractor(resumeContent, false);
    return parseAndValidateJson(rawOutput);
  } catch (initialError) {
    console.warn('[Extractor Warning] Initial extraction parse failed. Retrying...', initialError.message);
    try {
      const retryOutput = await callGeminiExtractor(resumeContent, true);
      return parseAndValidateJson(retryOutput);
    } catch (retryError) {
      console.error('[Extractor Error] Extraction validation failed on retry:', retryError);
      throw new Error(`Failed to extract structured profile from resume: ${retryError.message}`);
    }
  }
}

export default {
  extractResumeProfile,
  extractionSchema,
  setCustomAiClient,
  resetCustomAiClient,
};
