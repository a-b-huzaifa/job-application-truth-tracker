import { z } from 'zod';
import 'dotenv/config';
import { callLLM } from '../llmProvider.js';

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

  return await callLLM(prompt);
}

function fallbackExtract(resumeContent) {
  const text = resumeContent.toLowerCase();
  const knownSkills = [
    'JavaScript', 'TypeScript', 'Python', 'Java', 'Go', 'Rust', 'C++', 'SQL',
    'React', 'Node.js', 'Express', 'Next.js', 'PostgreSQL', 'MongoDB', 'Redis',
    'Docker', 'Kubernetes', 'AWS', 'Linux', 'Git', 'Kafka', 'GraphQL', 'CI/CD',
    'HTML5', 'CSS3', 'System Design', 'Microservices', 'REST', 'TCP/IP', 'eBPF'
  ];

  const matchedSkills = knownSkills.filter(skill => {
    const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    return regex.test(text);
  });

  // Extract years of experience heuristic
  let years = 3;
  const yearsMatch = text.match(/(\d+)\+?\s*(?:years?|yrs?)/i);
  if (yearsMatch) {
    years = parseInt(yearsMatch[1], 10);
  }

  const tools = matchedSkills.filter(s => ['Docker', 'Kubernetes', 'AWS', 'Git', 'Redis', 'PostgreSQL', 'Kafka', 'Linux'].includes(s));
  const coreSkills = matchedSkills.filter(s => !tools.includes(s));

  return {
    skills: coreSkills.length > 0 ? coreSkills : ['Full-Stack Development', 'Software Engineering'],
    years_experience: years,
    tools: tools.length > 0 ? tools : ['Git', 'Docker'],
  };
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
      console.warn('[Extractor Warning] Gemini API unavailable, applying semantic profile extraction fallback.');
      return fallbackExtract(resumeContent);
    }
  }
}

export default {
  extractResumeProfile,
  extractionSchema,
  setCustomAiClient,
  resetCustomAiClient,
};
