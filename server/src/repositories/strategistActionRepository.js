import { query } from '../db.js';

export async function createStrategistAction({
  userId,
  applicationId,
  actionType,
  payload = {},
  status = 'pending',
  applied = false,
  appliedAt = null,
  resolvedAt = null,
}) {
  const result = await query(
    `INSERT INTO strategist_actions (
      user_id, application_id, action_type, payload, status, applied, applied_at, resolved_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING id, user_id, application_id, action_type, payload, status, applied, applied_at, resolved_at, created_at`,
    [
      userId,
      applicationId,
      actionType,
      JSON.stringify(payload),
      status,
      applied,
      appliedAt,
      resolvedAt,
    ]
  );
  return result.rows[0];
}

export async function getStrategistActionById(id, userId, applicationId = null) {
  const conditions = ['id = $1', 'user_id = $2'];
  const params = [id, userId];

  if (applicationId) {
    conditions.push('application_id = $3');
    params.push(applicationId);
  }

  const result = await query(
    `SELECT id, user_id, application_id, action_type, payload, status, applied, applied_at, resolved_at, created_at
     FROM strategist_actions
     WHERE ${conditions.join(' AND ')}`,
    params
  );
  return result.rows[0] || null;
}

export async function getStrategistActionsByApplicationId(applicationId, userId) {
  const result = await query(
    `SELECT id, user_id, application_id, action_type, payload, status, applied, applied_at, resolved_at, created_at
     FROM strategist_actions
     WHERE application_id = $1 AND user_id = $2
     ORDER BY created_at ASC`,
    [applicationId, userId]
  );
  return result.rows;
}

export async function approveStrategistAction(id, userId, applicationId) {
  const result = await query(
    `UPDATE strategist_actions
     SET status = 'approved',
         applied = TRUE,
         applied_at = NOW(),
         resolved_at = NOW()
     WHERE id = $1 AND user_id = $2 AND application_id = $3 AND status = 'pending'
     RETURNING id, user_id, application_id, action_type, payload, status, applied, applied_at, resolved_at, created_at`,
    [id, userId, applicationId]
  );
  return result.rows[0] || null;
}

export async function rejectStrategistAction(id, userId, applicationId) {
  const result = await query(
    `UPDATE strategist_actions
     SET status = 'rejected',
         applied = FALSE,
         applied_at = NULL,
         resolved_at = NOW()
     WHERE id = $1 AND user_id = $2 AND application_id = $3 AND status = 'pending'
     RETURNING id, user_id, application_id, action_type, payload, status, applied, applied_at, resolved_at, created_at`,
    [id, userId, applicationId]
  );
  return result.rows[0] || null;
}

export default {
  createStrategistAction,
  getStrategistActionById,
  getStrategistActionsByApplicationId,
  approveStrategistAction,
  rejectStrategistAction,
};
