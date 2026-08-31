import { query } from '../db.js';
import { STALE_THRESHOLD_DAYS } from '../config/staleness.js';

/**
 * Checks for stale applications that have received no response after STALE_THRESHOLD_DAYS
 * and transitions their status from 'applied' to 'ghosted'.
 *
 * @param {object} [options]
 * @param {number} [options.thresholdDays=STALE_THRESHOLD_DAYS] - Custom day threshold for staleness
 * @param {string} [options.userId=null] - Optional user_id filter (if running for a single user)
 * @returns {Promise<{checked: number, flagged_as_ghosted: number, updated_ids: string[]}>}
 */
export async function checkForStaleApplications(options = {}) {
  const thresholdDays = options.thresholdDays || STALE_THRESHOLD_DAYS;
  const userId = options.userId || null;

  // 1. Calculate the total count of applications currently in 'applied' state
  let checkedCountSql = `SELECT count(*)::int as total FROM applications WHERE status = 'applied'`;
  const checkedParams = [];
  if (userId) {
    checkedCountSql += ` AND user_id = $1`;
    checkedParams.push(userId);
  }
  const checkedRes = await query(checkedCountSql, checkedParams);
  const checkedCount = checkedRes.rows[0]?.total || 0;

  // 2. Identify and update stale applications:
  // Must have status = 'applied' AND applied_at <= CURRENT_DATE - thresholdDays
  const updateParams = [thresholdDays];
  let updateSql = `
    UPDATE applications
    SET status = 'ghosted',
        last_status_check = NOW()
    WHERE status = 'applied'
      AND applied_at <= (CURRENT_DATE - ($1 * INTERVAL '1 day'))
  `;

  if (userId) {
    updateSql += ` AND user_id = $2`;
    updateParams.push(userId);
  }

  updateSql += ` RETURNING id, user_id, company_name, role_title, applied_at, status`;

  const updateRes = await query(updateSql, updateParams);
  const flaggedCount = updateRes.rowCount || 0;
  const updatedIds = updateRes.rows.map(r => r.id);

  if (flaggedCount > 0) {
    console.log(`[StaleCheck] Flagged ${flaggedCount} applications as 'ghosted' (Threshold: ${thresholdDays} days)`);
  }

  return {
    checked: checkedCount,
    flagged_as_ghosted: flaggedCount,
    updated_ids: updatedIds,
  };
}

export default {
  checkForStaleApplications,
};
