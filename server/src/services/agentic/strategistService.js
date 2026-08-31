import { z } from 'zod';
import 'dotenv/config';
import { callLLM } from '../llmProvider.js';

export const strategistActionSchema = z.object({
  claim: z.string(),
  action: z.enum(['REWRITE_SUGGESTED', 'APPLY_WITH_CAVEAT', 'SKIP_ROLE_RECOMMENDED']),
  reasoning: z.string(),
  suggested_rewrite: z.string().nullable().optional(),
  caveat_note: z.string().nullable().optional(),
  requires_human_approval: z.boolean(),
});

export const strategistOutputSchema = z.object({
  overall_recommendation: z.enum(['APPLY', 'APPLY_WITH_CAVEAT', 'REVISE_RESUME_FIRST', 'SKIP_ROLE']).default('APPLY_WITH_CAVEAT'),
  overall_rationale: z.string().default(''),
  actions: z.array(strategistActionSchema),
});

function parseAndValidateJson(rawText) {
  let cleaned = rawText.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  const parsed = JSON.parse(cleaned);
  const validated = strategistOutputSchema.parse(parsed);

  // Enforce invariant: requires_human_approval must be true for REWRITE_SUGGESTED and SKIP_ROLE_RECOMMENDED
  const enforcedActions = validated.actions.map(action => {
    const isApprovalRequired = action.action === 'REWRITE_SUGGESTED' || action.action === 'SKIP_ROLE_RECOMMENDED';
    return {
      ...action,
      requires_human_approval: isApprovalRequired ? true : (action.requires_human_approval ?? false),
    };
  });

  return {
    ...validated,
    actions: enforcedActions,
  };
}

let customAiClient = null;

export function setCustomAiClient(mockClient) {
  customAiClient = mockClient;
}

export function resetCustomAiClient() {
  customAiClient = null;
}

async function callGeminiStrategist({ resumeContent, jobDescription, verifiedScore, verifications }, isRetry = false) {
  if (customAiClient) {
    return await customAiClient.generateContent({
      resumeContent,
      jobDescription,
      verifiedScore,
      verifications,
      isRetry,
    });
  }

  const verificationsJson = JSON.stringify(verifications, null, 2);

  const prompt = isRetry
    ? `CRITICAL: You MUST return ONLY a valid, raw JSON object (NO markdown, NO extra text).
You are an expert career strategist. Given the verifications of match gaps, determine strategic actions.

JOB DESCRIPTION:
${jobDescription}

VERIFIED FIT SCORE: ${verifiedScore}/100

VERIFICATIONS:
${verificationsJson}

ACTION RULES:
- REWRITE_SUGGESTED: For claims flagged as phrasing_risk or unsupported where wording can be corrected or strengthened. Draft suggested_rewrite (data only, candidate reviews). requires_human_approval MUST be true.
- APPLY_WITH_CAVEAT: For acceptable framing risks or minor gaps that candidate can address in cover letter or interview. requires_human_approval is false.
- SKIP_ROLE_RECOMMENDED: Evidence gap is too massive or fundamental core requirements are unbridgeable. requires_human_approval MUST be true.

JSON SCHEMA:
{
  "overall_recommendation": "APPLY" | "APPLY_WITH_CAVEAT" | "REVISE_RESUME_FIRST" | "SKIP_ROLE",
  "overall_rationale": "<summary of overall strategy>",
  "actions": [
    {
      "claim": "<exact claim>",
      "action": "REWRITE_SUGGESTED" | "APPLY_WITH_CAVEAT" | "SKIP_ROLE_RECOMMENDED",
      "reasoning": "<why this action was chosen>",
      "suggested_rewrite": "<draft phrasing or null>",
      "caveat_note": "<caveat notes or null>",
      "requires_human_approval": true | false
    }
  ]
}`
    : `You are an elite Candidate Strategist in an agentic truth tracking system.
Given the verified match diagnoses and fit score (${verifiedScore}/100), decide strategic next steps.

JOB DESCRIPTION:
${jobDescription}

VERIFIED EVIDENCE:
${verificationsJson}

DECISION MATRIX PER CLAIM:
1. REWRITE_SUGGESTED: When a phrasing risk or skill framing can be fixed by drafting a targeted bullet point. Provide suggested_rewrite. requires_human_approval = true.
2. APPLY_WITH_CAVEAT: When the gap is minor, acceptable, or can be addressed conversationally during the screening interview. requires_human_approval = false.
3. SKIP_ROLE_RECOMMENDED: When the qualification mismatch is irreconcilable (e.g. missing 5+ years of a core mandatory domain), saving the candidate from wasting time. requires_human_approval = true.

Return strictly as JSON matching this schema:
{
  "overall_recommendation": "APPLY_WITH_CAVEAT",
  "overall_rationale": "High match overall, but address framing caveat before applying.",
  "actions": [
    {
      "claim": "Missing explicit AWS cloud infrastructure experience",
      "action": "APPLY_WITH_CAVEAT",
      "reasoning": "Candidate has strong Docker/Kubernetes backend skills; AWS can be learned on the job.",
      "caveat_note": "Highlight containerization versatility during initial recruiter screen.",
      "requires_human_approval": false
    }
  ]
}`;

  return await callLLM(prompt);
}

/**
 * Generates actionable strategy decisions based on verified gap evaluations.
 *
 * @param {object} params
 * @param {string} params.resumeContent - Raw resume text
 * @param {string} params.jobDescription - Full job description text
 * @param {number} params.verifiedScore - Score output by verifier
 * @param {Array<object>} params.verifications - Array of verification items from verifierService
 * @returns {Promise<{overall_recommendation: string, overall_rationale: string, actions: Array<object>}>}
 */
export async function determineApplicationStrategy({ resumeContent, jobDescription, verifiedScore, verifications }) {
  if (!Array.isArray(verifications) || verifications.length === 0) {
    return {
      overall_recommendation: verifiedScore >= 75 ? 'APPLY' : 'APPLY_WITH_CAVEAT',
      overall_rationale: 'No specific mismatch claims flagged for review.',
      actions: [],
    };
  }

function fallbackStrategy(verifiedScore, verifications) {
  const actions = verifications.map(v => {
    if (v.flag_type === 'phrasing_risk') {
      return {
        claim: v.claim,
        action: 'REWRITE_SUGGESTED',
        reasoning: 'Phrasing may trigger reviewer skepticism; suggest reframing with quantitative impact metrics.',
        suggested_rewrite: 'Engineered scalable core production systems delivering robust throughput and high availability.',
        requires_human_approval: true,
      };
    }
    if (v.flag_type === 'unsupported') {
      return {
        claim: v.claim,
        action: 'APPLY_WITH_CAVEAT',
        reasoning: 'Evaluator missed this qualification; highlight competency during technical conversation.',
        caveat_note: 'Clarify relevant hands-on experience during the recruiter phone screen.',
        requires_human_approval: false,
      };
    }
    if (verifiedScore < 40) {
      return {
        claim: v.claim,
        action: 'SKIP_ROLE_RECOMMENDED',
        reasoning: 'Substantial qualification gap between resume competencies and mandatory job requirements.',
        requires_human_approval: true,
      };
    }
    return {
      claim: v.claim,
      action: 'APPLY_WITH_CAVEAT',
      reasoning: 'Transferable skill set bridges requirement gap.',
      caveat_note: 'Discuss adjacent architecture in technical design interview.',
      requires_human_approval: false,
    };
  });

  let rec = 'APPLY';
  if (verifiedScore < 40) {
    rec = 'SKIP_ROLE';
  } else if (actions.some(a => a.action === 'REWRITE_SUGGESTED')) {
    rec = 'REVISE_RESUME_FIRST';
  } else if (verifiedScore < 75 || actions.some(a => a.action === 'APPLY_WITH_CAVEAT')) {
    rec = 'APPLY_WITH_CAVEAT';
  }

  return {
    overall_recommendation: rec,
    overall_rationale: `Strategy computed based on verified score of ${verifiedScore}% and audited claim friction.`,
    actions,
  };
}

  try {
    const rawOutput = await callGeminiStrategist({
      resumeContent,
      jobDescription,
      verifiedScore,
      verifications,
    }, false);
    return parseAndValidateJson(rawOutput);
  } catch (initialError) {
    console.warn('[Strategist Warning] Initial strategy parse failed. Retrying...', initialError.message);
    try {
      const retryOutput = await callGeminiStrategist({
        resumeContent,
        jobDescription,
        verifiedScore,
        verifications,
      }, true);
      return parseAndValidateJson(retryOutput);
    } catch (retryError) {
      console.warn('[Strategist Warning] Gemini API unavailable, applying semantic strategy fallback.');
      return fallbackStrategy(verifiedScore, verifications);
    }
  }
}

export default {
  determineApplicationStrategy,
  strategistActionSchema,
  strategistOutputSchema,
  setCustomAiClient,
  resetCustomAiClient,
};
