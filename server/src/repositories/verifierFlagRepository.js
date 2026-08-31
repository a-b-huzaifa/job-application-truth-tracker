import { query } from '../db.js';

/**
 * Persists an individual verifier flag record.
 *
 * @param {object} params
 * @param {string} params.resumeId - UUID of the resume
 * @param {string} params.claimText - The exact claimed mismatch text
 * @param {'unsupported'|'phrasing_risk'} params.flagType - Classification of the flag
 * @returns {Promise<object>}
 */
export async function createVerifierFlag({ resumeId, claimText, flagType }) {
  const result = await query(
    `INSERT INTO verifier_flags (resume_id, claim_text, flag_type)
     VALUES ($1, $2, $3)
     RETURNING id, resume_id, claim_text, flag_type, created_at`,
    [resumeId, claimText, flagType]
  );
  return result.rows[0];
}

/**
 * Retrieves all raw verifier flag records for a resume variant.
 *
 * @param {string} resumeId
 * @returns {Promise<Array<object>>}
 */
export async function getFlagsByResumeId(resumeId) {
  const result = await query(
    `SELECT id, resume_id, claim_text, flag_type, created_at
     FROM verifier_flags
     WHERE resume_id = $1
     ORDER BY created_at DESC`,
    [resumeId]
  );
  return result.rows;
}

/**
 * Retrieves aggregated historical flag patterns grouped by flag_type and claim frequency.
 *
 * @param {string} resumeId
 * @returns {Promise<Array<object>>}
 */
export async function getAggregatedFlagsByResumeId(resumeId) {
  const result = await query(
    `SELECT 
       flag_type,
       claim_text,
       COUNT(*)::int as frequency,
       MAX(created_at) as last_seen_at
     FROM verifier_flags
     WHERE resume_id = $1
     GROUP BY flag_type, claim_text
     ORDER BY frequency DESC, last_seen_at DESC`,
    [resumeId]
  );
  return result.rows;
}

export default {
  createVerifierFlag,
  getFlagsByResumeId,
  getAggregatedFlagsByResumeId,
};
