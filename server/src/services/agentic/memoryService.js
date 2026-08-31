import verifierFlagRepository from '../../repositories/verifierFlagRepository.js';

/**
 * Generates an advisory warning message for a repeatedly flagged claim.
 *
 * @param {string} claimText
 * @param {'unsupported'|'phrasing_risk'} flagType
 * @param {number} frequency
 * @returns {string}
 */
function buildWarningText(claimText, flagType, frequency) {
  const timesStr = frequency === 1 ? '1 analysis' : `${frequency} separate analyses`;
  if (flagType === 'unsupported') {
    return `Evaluator hallucinated "${claimText}" as missing across ${timesStr}. Consider making this skill or qualification more prominent in your resume to avoid ATS / screener false negatives.`;
  }
  if (flagType === 'phrasing_risk') {
    return `Evaluator repeatedly flagged "${claimText}" as an aggressive phrasing risk across ${timesStr}. Consider toning down or reframing this bullet point to prevent human reviewer skepticism.`;
  }
  return `Repeatedly flagged across ${timesStr}.`;
}

/**
 * Analyzes historical verifier flags for a specific resume variant and extracts
 * persistent pattern warnings grouped by flag_type and frequency.
 *
 * @param {string} resumeId - UUID of the resume variant
 * @returns {Promise<{
 *   resume_id: string,
 *   total_flags: number,
 *   by_flag_type: {
 *     unsupported: Array<{claim_text: string, frequency: number, last_seen_at: string}>,
 *     phrasing_risk: Array<{claim_text: string, frequency: number, last_seen_at: string}>
 *   },
 *   pattern_warnings: Array<{
 *     claim_text: string,
 *     flag_type: string,
 *     frequency: number,
 *     warning: string
 *   }>
 * }>}
 */
export async function getResumePatternWarnings(resumeId) {
  if (!resumeId) {
    throw new Error('resumeId is required to retrieve pattern warnings');
  }

  const aggregatedRows = await verifierFlagRepository.getAggregatedFlagsByResumeId(resumeId);

  const byFlagType = {
    unsupported: [],
    phrasing_risk: [],
  };

  let totalFlags = 0;
  const patternWarnings = [];

  for (const row of aggregatedRows) {
    const item = {
      claim_text: row.claim_text,
      frequency: row.frequency,
      last_seen_at: row.last_seen_at,
    };

    totalFlags += row.frequency;

    if (row.flag_type === 'unsupported') {
      byFlagType.unsupported.push(item);
    } else if (row.flag_type === 'phrasing_risk') {
      byFlagType.phrasing_risk.push(item);
    }

    // Generate proactive warning
    patternWarnings.push({
      claim_text: row.claim_text,
      flag_type: row.flag_type,
      frequency: row.frequency,
      warning: buildWarningText(row.claim_text, row.flag_type, row.frequency),
    });
  }

  // Sort pattern warnings by frequency descending
  patternWarnings.sort((a, b) => b.frequency - a.frequency);

  return {
    resume_id: resumeId,
    total_flags: totalFlags,
    by_flag_type: byFlagType,
    pattern_warnings: patternWarnings,
  };
}

export default {
  getResumePatternWarnings,
};
