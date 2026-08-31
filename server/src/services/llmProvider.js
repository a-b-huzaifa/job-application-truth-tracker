import { GoogleGenerativeAI } from '@google/generative-ai';
import OpenAI from 'openai';
import 'dotenv/config';

let customAiClient = null;

export function setCustomAiClient(mockClient) {
  customAiClient = mockClient;
}

export function resetCustomAiClient() {
  customAiClient = null;
}

/**
 * Unified LLM Provider Layer
 * Supports: 'gemini' (default), 'openrouter', 'openai'
 * 
 * @param {string} prompt - The prompt to send to the LLM.
 * @returns {Promise<string>} The LLM's raw text response.
 */
export async function callLLM(prompt) {
  if (customAiClient) {
    // For tests
    return await customAiClient.generateContent({ prompt });
  }

  const provider = (process.env.AI_PROVIDER || 'gemini').toLowerCase();

  switch (provider) {
    case 'openrouter':
      return await callOpenRouter(prompt);
    case 'openai':
      return await callOpenAI(prompt);
    case 'gemini':
    default:
      return await callGemini(prompt);
  }
}

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not configured in environment variables');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });

  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function callOpenRouter(prompt) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is not configured in environment variables');
  }

  const openai = new OpenAI({
    baseURL: 'https://openrouter.ai/api/v1',
    apiKey: apiKey,
  });

  const completion = await openai.chat.completions.create({
    model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct',
    messages: [
      { role: 'user', content: prompt }
    ],
  });

  return completion.choices[0].message.content;
}

async function callOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured in environment variables');
  }

  const openai = new OpenAI({
    apiKey: apiKey,
  });

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'user', content: prompt }
    ],
  });

  return completion.choices[0].message.content;
}

export default {
  callLLM,
  setCustomAiClient,
  resetCustomAiClient,
};
