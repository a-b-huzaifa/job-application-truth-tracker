import dotenv from 'dotenv';
import { callLLM } from '../llmProvider.js';

dotenv.config();

/**
 * Tailors a base resume for a specific job description.
 * Uses Gemini to rewrite and emphasize relevant skills without hallucinating.
 * @param {string} baseResume - The original resume text.
 * @param {string} jobDescription - The target job description.
 * @param {string} roleTitle - The target role title.
 * @param {string} companyName - The target company name.
 * @returns {Promise<string>} - The tailored resume text.
 */
export async function tailorResume(baseResume, jobDescription, roleTitle, companyName) {
  const prompt = `
You are an expert Executive Resume Writer and Career Strategist.
Your task is to tailor a candidate's existing resume to a specific job description.

Target Role: ${roleTitle}
Target Company: ${companyName}

Original Resume:
"""
${baseResume}
"""

Job Description:
"""
${jobDescription}
"""

INSTRUCTIONS:
1. Re-write the resume to emphasize skills and experiences that align with the Job Description.
2. DO NOT hallucinate, invent, or fabricate any jobs, degrees, or skills that are not present in or strongly implied by the original resume.
3. Improve phrasing to be more impactful and results-oriented where possible.
4. Keep the output strictly as the text of the tailored resume (no conversational filler, no markdown wrappers like \`\`\` unless needed for formatting).
5. Ensure the structure is clean and professional.
`;

  const responseText = await callLLM(prompt);
  return responseText.trim();
}
