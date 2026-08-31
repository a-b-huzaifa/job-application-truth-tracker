import { query } from '../db.js';

export async function getAnalysisByHash(jobDescriptionHash) {
  const result = await query(
    `SELECT id, application_id, fit_score, mismatch_reasons, agentic_analysis, job_description_hash, created_at
     FROM llm_analyses
     WHERE job_description_hash = $1`,
    [jobDescriptionHash]
  );
  return result.rows[0] || null;
}

export async function getAnalysisByApplicationId(applicationId) {
  const result = await query(
    `SELECT id, application_id, fit_score, mismatch_reasons, agentic_analysis, job_description_hash, created_at
     FROM llm_analyses
     WHERE application_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [applicationId]
  );
  return result.rows[0] || null;
}

export async function createAnalysis(applicationId, fitScore, mismatchReasons, jobDescriptionHash) {
  const result = await query(
    `INSERT INTO llm_analyses (
      application_id, fit_score, mismatch_reasons, job_description_hash
    ) VALUES ($1, $2, $3, $4)
    ON CONFLICT (job_description_hash) DO UPDATE
    SET fit_score = EXCLUDED.fit_score,
        mismatch_reasons = EXCLUDED.mismatch_reasons
    RETURNING id, application_id, fit_score, mismatch_reasons, agentic_analysis, job_description_hash, created_at`,
    [
      applicationId,
      fitScore,
      JSON.stringify(mismatchReasons),
      jobDescriptionHash,
    ]
  );
  return result.rows[0];
}

export async function updateAgenticAnalysis(id, agenticAnalysis) {
  const result = await query(
    `UPDATE llm_analyses
     SET agentic_analysis = $1
     WHERE id = $2
     RETURNING id`,
    [JSON.stringify(agenticAnalysis), id]
  );
  return result.rowCount > 0;
}

export default {
  getAnalysisByHash,
  getAnalysisByApplicationId,
  createAnalysis,
  updateAgenticAnalysis,
};
