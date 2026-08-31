import { query } from '../db.js';

export async function createReportRecord(userId, periodStart, periodEnd, filePath) {
  const result = await query(
    `INSERT INTO weekly_reports (user_id, period_start, period_end, file_path)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, period_start, period_end, file_path, generated_at`,
    [userId, periodStart, periodEnd, filePath]
  );
  return result.rows[0];
}

export async function getReportsByUserId(userId) {
  const result = await query(
    `SELECT id, user_id, period_start, period_end, file_path, generated_at
     FROM weekly_reports
     WHERE user_id = $1
     ORDER BY generated_at DESC`,
    [userId]
  );
  return result.rows;
}

export async function getReportById(id, userId) {
  const result = await query(
    `SELECT id, user_id, period_start, period_end, file_path, generated_at
     FROM weekly_reports
     WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return result.rows[0] || null;
}

export default {
  createReportRecord,
  getReportsByUserId,
  getReportById,
};
